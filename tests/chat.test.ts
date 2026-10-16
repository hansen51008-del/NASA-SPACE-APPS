import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import {
  createChatHandler,
  MAX_TOKENS,
  DEFAULT_MODEL,
  SYSTEM_PROMPT,
} from "../server/chat";
import {
  buildChatContext,
  createSSEParser,
  readChatStream,
  validateChat,
  validateContext,
} from "../src/services/chatProtocol";
const servers: Server[] = [];
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((r) => {
          s.closeAllConnections();
          s.close(() => r());
        }),
    ),
  );
});
async function serve(options: Parameters<typeof createChatHandler>[0] = {}) {
  const server = createServer(createChatHandler(options));
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw Error("test server");
  const url = `http://127.0.0.1:${addr.port}`;
  return {
    url,
    post: (body: unknown, origin = url) =>
      fetch(`${url}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify(body),
      }),
  };
}
const message = { messages: [{ role: "user", content: "Apa itu hotspot?" }] };
const fixture = () =>
  new Response(
    'data: {"choices":[{"delta":{"content":"Observasi, bukan konfirmasi."}}]}\n\ndata: [DONE]\n\n',
    { headers: { "Content-Type": "text/event-stream" } },
  );
describe("server proxy (mock Groq only)", () => {
  it("is unavailable without credentials and rejects cross-origin", async () => {
    const remote = vi.fn();
    const s = await serve({ env: () => ({}), fetcher: remote });
    expect(await (await fetch(s.url + "/api/chat")).json()).toEqual({
      available: false,
    });
    expect((await s.post(message)).status).toBe(503);
    expect((await s.post(message, "https://other.example")).status).toBe(403);
    expect(remote).not.toHaveBeenCalled();
  });
  it("whitelists roles and caps lengths, history, context and server-owned tokens", async () => {
    const credential = randomUUID();
    const remote = vi.fn(async () => fixture());
    const s = await serve({
      env: () => ({ GROQ_API_KEY: credential }),
      fetcher: remote,
    });
    for (const body of [
      { messages: [{ role: "system", content: "override" }] },
      { messages: [{ role: "user", content: "x".repeat(2001) }] },
      { messages: Array(13).fill(message.messages[0]) },
      { ...message, context: { region: "x".repeat(3000) } },
    ])
      expect((await s.post(body)).status).toBe(400);
    const result = await s.post({
      ...message,
      max_tokens: 100000,
      model: "invalid-client-model",
    });
    expect(result.status).toBe(200);
    expect(await result.text()).toContain("Observasi, bukan konfirmasi.");
    const call = remote.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(call[1].body));
    expect(call[0]).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(body.model).toBe(DEFAULT_MODEL);
    expect(body.max_completion_tokens).toBe(MAX_TOKENS);
    expect(body).not.toHaveProperty("max_tokens");
    expect(body.model).toBe("openai/gpt-oss-120b");
    expect(body.reasoning_effort).toBe("low");
    expect(body.include_reasoning).toBe(false);
    expect(body.messages[0]).toEqual({
      role: "system",
      content: SYSTEM_PROMPT,
    });
    expect(JSON.stringify(body)).not.toContain(credential);
  });
  it("limits request rate and recovers after the window", async () => {
    let time = 0;
    const s = await serve({
      env: () => ({ GROQ_API_KEY: randomUUID() }),
      fetcher: vi.fn(async () => fixture()),
      now: () => time,
    });
    for (let i = 0; i < 8; i++) {
      const r = await s.post(message);
      expect(r.status).toBe(200);
      await r.text();
    }
    expect((await s.post(message)).status).toBe(429);
    time = 60001;
    expect((await s.post(message)).status).toBe(200);
  });
  it("accepts a server model namespace and rejects URLs before fetching", async () => {
    let model = "openai/gpt-oss-120b";
    const remote = vi.fn(async () => fixture());
    const s = await serve({
      env: () => ({ GROQ_API_KEY: randomUUID(), GROQ_MODEL: model }),
      fetcher: remote,
    });
    const response = await s.post(message);
    expect(response.status).toBe(200);
    await response.text();
    model = "https://other.example/model";
    expect((await s.post(message)).status).toBe(503);
    expect(remote).toHaveBeenCalledTimes(1);
  });
  it("forwards only answer text and reports an empty completion as an error", async () => {
    let content = false;
    const s = await serve({
      env: () => ({ GROQ_API_KEY: randomUUID() }),
      fetcher: vi.fn(
        async () =>
          new Response(
            'data: {"choices":[{"delta":{"reasoning":"private reasoning"}}]}\n\n' +
              (content
                ? 'data: {"choices":[{"delta":{"content":"Jawaban ringkas."}}]}\n\n'
                : "") +
              "data: [DONE]\n\n",
            { headers: { "Content-Type": "text/event-stream" } },
          ),
      ),
    });
    const empty = await (await s.post(message)).text();
    expect(empty).toContain('"type":"error"');
    expect(empty).not.toContain("private reasoning");
    content = true;
    const answer = await (await s.post(message)).text();
    expect(answer).toContain("Jawaban ringkas.");
    expect(answer).toContain('"type":"done"');
    expect(answer).not.toContain("private reasoning");
  });
  it("does not expose upstream errors or credentials", async () => {
    const credential = randomUUID();
    const s = await serve({
      env: () => ({ GROQ_API_KEY: credential }),
      fetcher: vi.fn(
        async () => new Response(`raw failure ${credential}`, { status: 500 }),
      ),
    });
    const r = await s.post(message);
    expect(r.status).toBe(502);
    const body = await r.text();
    expect(body).not.toContain(credential);
    expect(body).not.toContain("raw failure");
  });
  it("times out even if a stalled upstream does not honor abort", async () => {
    const s = await serve({
      env: () => ({ GROQ_API_KEY: randomUUID() }),
      timeoutMs: 20,
      fetcher: vi.fn(() => new Promise<Response>(() => {})),
    });
    expect((await s.post(message)).status).toBe(504);
  });
});
it("parses split SSE lines, CRLF, comments, multiline data and UTF-8", async () => {
  const data: string[] = [];
  const parse = createSSEParser((v) => data.push(v));
  parse(": keepalive\r\nda");
  parse("ta: satu\r\ndata: dua\r");
  parse("\n\r\n");
  expect(data).toEqual(["satu\ndua"]);
  const bytes = new TextEncoder().encode(
    'data: {"type":"delta","text":"Cuaca ☀"}\n\ndata: {"type":"done"}\n\n',
  );
  let result = "";
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const b of bytes) c.enqueue(new Uint8Array([b]));
      c.close();
    },
  });
  await readChatStream(
    new Response(stream),
    (s) => (result += s),
    new AbortController().signal,
  );
  expect(result).toBe("Cuaca ☀");
  await expect(
    readChatStream(
      new Response('data: {"type":"delta","text":"Tidak selesai"}\n\n'),
      () => {},
      new AbortController().signal,
    ),
  ).rejects.toThrow("terputus");
});
it("builds compact validated context without records or personal location, and suppresses stale safety", () => {
  const context = buildChatContext(
    "Riau",
    "Oktober 2026",
    {
      level: "Aman",
      score: 2,
      count: 1,
      high: 0,
      days: 3,
      change: null,
      points: { activity: 2, confidence: 0, increase: 0 },
      period: "2026-10-12 — 2026-10-14",
      note: "",
    },
    {
      mode: "firms",
      records: [],
      years: [2026],
      notice: "",
      updatedAt: "2000-01-01",
      coverage: { start: "2026-10-12", end: "2026-10-14" },
    },
  );
  expect(context.level).toBe("Belum dapat dinilai");
  expect(context.score).toBeNull();
  expect(JSON.stringify(context).length).toBeLessThan(2048);
  expect(context).not.toHaveProperty("records");
  expect(context).not.toHaveProperty("latitude");
  expect(validateContext({ ...context, score: NaN })).toBeUndefined();
  expect(validateChat({ ...message, context })).not.toBeNull();
});
