import type { RiskIndicator } from "./riskService";
import type { ObservationDataset } from "./observationProvider";
export const MAX_MESSAGE_CHARS = 2000,
  MAX_HISTORY = 12,
  MAX_TOTAL_CHARS = 12000;
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
export interface ChatContext {
  region: string;
  period: string;
  level: string;
  score: number | null;
  factors: { activity: number; confidence: number; increase: number };
  source: "Mode Demo" | "Cache NASA FIRMS";
  coverage: string;
  updatedAt: string;
}
const label = (v: unknown, max: number) =>
  typeof v === "string"
    ? v.replace(/[\u0000-\u001f<>]/g, " ").slice(0, max)
    : "";
export function validateContext(value: unknown): ChatContext | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    JSON.stringify(value).length > 2048
  )
    return;
  const v = value as Partial<ChatContext>,
    f = v.factors;
  if (
    !["Mode Demo", "Cache NASA FIRMS"].includes(v.source ?? "") ||
    !["Aman", "Waspada", "Siaga", "Belum dapat dinilai"].includes(v.level ?? "")
  )
    return;
  if (
    v.score !== null &&
    (typeof v.score !== "number" ||
      !Number.isFinite(v.score) ||
      v.score < 0 ||
      v.score > 100)
  )
    return;
  if (
    !f ||
    [f.activity, f.confidence, f.increase].some(
      (n) => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 100,
    )
  )
    return;
  return {
    region: label(v.region, 70),
    period: label(v.period, 110),
    level: v.level!,
    score: v.score ?? null,
    factors: {
      activity: f.activity,
      confidence: f.confidence,
      increase: f.increase,
    },
    source: v.source!,
    coverage: label(v.coverage, 80),
    updatedAt: label(v.updatedAt, 30),
  };
}
export function buildChatContext(
  region: string,
  period: string,
  risk: RiskIndicator,
  dataset: ObservationDataset,
  pending = false,
): ChatContext {
  const stale =
    dataset.mode === "firms" &&
    (!dataset.updatedAt ||
      Date.now() - Date.parse(dataset.updatedAt) > 7 * 86400000);
  return validateContext({
    region,
    period,
    level:
      pending || stale
        ? "Belum dapat dinilai"
        : (risk.level ?? "Belum dapat dinilai"),
    score: pending || stale ? null : risk.score,
    factors: risk.points,
    source: dataset.mode === "demo" ? "Mode Demo" : "Cache NASA FIRMS",
    coverage: dataset.coverage
      ? `${dataset.coverage.start} — ${dataset.coverage.end} UTC`
      : risk.period,
    updatedAt: dataset.updatedAt ?? "",
  })!;
}
export function validateChat(
  value: unknown,
): { messages: ChatMessage[]; context?: ChatContext } | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { messages?: unknown; context?: unknown };
  if (
    !Array.isArray(v.messages) ||
    !v.messages.length ||
    v.messages.length > MAX_HISTORY
  )
    return null;
  let total = 0;
  const messages: ChatMessage[] = [];
  for (const m of v.messages) {
    if (
      !m ||
      !["user", "assistant"].includes(m.role) ||
      typeof m.content !== "string" ||
      !m.content.trim() ||
      m.content.length > MAX_MESSAGE_CHARS
    )
      return null;
    total += m.content.length;
    messages.push({ role: m.role, content: m.content });
  }
  if (total > MAX_TOTAL_CHARS || messages.at(-1)?.role !== "user") return null;
  const context = validateContext(v.context);
  if (v.context !== undefined && !context) return null;
  return { messages, context };
}
// Both upstream and browser streams can split UTF-8 and SSE lines anywhere.
export function createSSEParser(onData: (data: string) => void) {
  let pending = "";
  return (chunk: string) => {
    pending += chunk;
    if (pending.length > 65536) throw Error("Stream tidak valid");
    let match: RegExpExecArray | null;
    while ((match = /\r?\n\r?\n/.exec(pending))) {
      const block = pending.slice(0, match.index);
      pending = pending.slice(match.index + match[0].length);
      const data = block
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).replace(/^ /, ""))
        .join("\n");
      if (data) onData(data);
    }
  };
}
export async function readChatStream(
  response: Response,
  onText: (text: string) => void,
  signal: AbortSignal,
) {
  if (!response.ok || !response.body)
    throw Error(
      response.status === 429
        ? "Batas permintaan tercapai. Coba lagi nanti."
        : "Asisten AI sedang tidak tersedia.",
    );
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let done = false;
  const parse = createSSEParser((data) => {
    const event = JSON.parse(data);
    if (event.type === "delta" && typeof event.text === "string")
      onText(event.text);
    else if (event.type === "done") done = true;
    else if (event.type === "error")
      throw Error("Jawaban terputus. Silakan coba lagi.");
  });
  const abort = () => {
    void reader.cancel();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (!signal.aborted) {
      const chunk = await reader.read();
      if (chunk.done) break;
      parse(decoder.decode(chunk.value, { stream: true }));
    }
    if (!done && !signal.aborted)
      throw Error("Jawaban terputus. Silakan coba lagi.");
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
