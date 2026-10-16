import { useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  ArrowUp,
  Square,
  Copy,
  Check,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import type { ChatContext, ChatMessage } from "../services/chatProtocol";
import {
  MAX_MESSAGE_CHARS,
  MAX_HISTORY,
  MAX_TOTAL_CHARS,
  readChatStream,
} from "../services/chatProtocol";
import "../chat.css";
const groups = [
  [
    "Memahami data",
    "Apa arti level Aman, Waspada, dan Siaga?",
    "Apakah hotspot sama dengan kebakaran?",
    "Jelaskan skor risiko wilayah yang sedang saya pilih",
    "Dari mana data aplikasi ini berasal dan apa batasnya?",
  ],
  [
    "Kesiapsiagaan",
    "Apa yang perlu ada di tas siaga keluarga untuk karhutla?",
    "Bagaimana melindungi keluarga dari kabut asap?",
  ],
  [
    "Menggunakan aplikasi",
    "Bagaimana cara membaca Peta aktivitas?",
    "Kenapa data cuaca belum dihitung dalam skor?",
  ],
  ["Wawasan", "Apa hubungan karhutla dengan SDG 13 dan 15?"],
];
const facts = [
  "Hotspot adalah observasi satelit, bukan konfirmasi kebakaran.",
  "Label Aman bukan jaminan bebas bahaya.",
  "Cache FIRMS mencakup beberapa hari UTC yang telah selesai.",
  "Cuaca model ditampilkan sebagai konteks dan tidak masuk skor.",
];
const faq = [
  [
    "Apakah skor ini prediksi kebakaran?",
    "Bukan. Skor adalah heuristik prototype dari aktivitas observasi dan keyakinan sensor, belum tervalidasi. Ikuti arahan resmi setempat.",
  ],
  [
    "Apa bedanya Mode Demo dan Cache NASA FIRMS?",
    "Mode Demo memakai data sintetis. Cache NASA FIRMS memakai observasi publik yang diperbarui saat sinkronisasi, dengan cakupan terbatas.",
  ],
  [
    "Apakah titik kumpul di aplikasi resmi?",
    "Titik kumpul dan rencana bantuan masih simulasi. Konfirmasi kepada BPBD atau pemerintah setempat sebelum digunakan.",
  ],
];
function SafeAnswer({ text }: { text: string }) {
  return (
    <div className="chat-answer">
      {text.split("\n").map((line, i) => (
        <p key={i}>
          {line
            .split(/(\*\*[^*]+\*\*)/g)
            .map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j}>{part.slice(2, -2)}</strong>
              ) : (
                part
              ),
            )}
        </p>
      ))}
    </div>
  );
}
export default function AssistantChat({
  context,
  active,
  onNavigate,
}: {
  context: ChatContext;
  active: boolean;
  onNavigate: (tab: "map" | "data") => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null),
    [checkVersion, setCheckVersion] = useState(0),
    [fact, setFact] = useState(0),
    [copied, setCopied] = useState(-1),
    [stopped, setStopped] = useState(false);
  const controller = useRef<AbortController | null>(null),
    scroller = useRef<HTMLDivElement>(null),
    nearBottom = useRef(true),
    textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), 8000);
    fetch("/api/chat", { signal: c.signal, cache: "no-store" })
      .then(async (r) => {
        const v = await r.json();
        if (!c.signal.aborted) setAvailable(r.ok && v.available === true);
      })
      .catch(() => setAvailable(false))
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [checkVersion]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!active) {
      controller.current?.abort();
      return;
    }
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches || messages.length) return;
    const timer = setInterval(() => {
      if (!document.hidden && !media.matches)
        setFact((f) => (f + 1) % facts.length);
    }, 9000);
    return () => clearInterval(timer);
  }, [active, messages.length]);
  useEffect(() => {
    if (nearBottom.current && scroller.current)
      scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages, busy]);
  async function send(text: string, retry = false) {
    if (!available || busy || !text.trim()) return;
    const base = retry
      ? messages.slice(0, messages.map((m) => m.role).lastIndexOf("user"))
      : messages;
    const next: ChatMessage[] = [
      ...base,
      { role: "user", content: text.trim().slice(0, MAX_MESSAGE_CHARS) },
    ];
    let total = 0;
    const history: ChatMessage[] = [];
    for (const m of next.slice(-MAX_HISTORY).reverse()) {
      const content = m.content.slice(0, MAX_MESSAGE_CHARS);
      if (total + content.length > MAX_TOTAL_CHARS) break;
      if (content.trim()) {
        history.unshift({ ...m, content });
        total += content.length;
      }
    }
    const c = new AbortController();
    controller.current = c;
    nearBottom.current = true;
    setMessages([...next, { role: "assistant", content: "" }]);
    setBusy(true);
    setError("");
    setStopped(false);
    setInput("");
    const timeout = setTimeout(() => c.abort(), 35000);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, context }),
        signal: c.signal,
      });
      if (response.status === 503) setAvailable(false);
      await readChatStream(
        response,
        (delta) => {
          if (c.signal.aborted) return;
          setMessages((current) =>
            current.map((m, i) =>
              i === current.length - 1
                ? { ...m, content: m.content + delta }
                : m,
            ),
          );
        },
        c.signal,
      );
    } catch (e) {
      if (!c.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Asisten AI sedang tidak tersedia.",
        );
    } finally {
      clearTimeout(timeout);
      if (c.signal.aborted) setStopped(true);
      if (controller.current === c) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  const ask = (text: string) => {
    if (available) void send(text);
    else {
      setInput(text);
      textarea.current?.focus();
    }
  };
  const suggestions = (
    <div className="chat-topics">
      {groups.map(([title, ...prompts]) => (
        <section key={title}>
          <h3>{title}</h3>
          {prompts.map((prompt) => (
            <button
              key={prompt}
              disabled={busy || !available}
              onClick={() => ask(prompt)}
            >
              {prompt}
              <ArrowUpRight size={14} />
            </button>
          ))}
        </section>
      ))}
    </div>
  );
  const lastQuestion = [...messages]
    .reverse()
    .find((m) => m.role === "user")?.content;
  return (
    <div
      className={`assistant-chat ${messages.length ? "has-conversation" : "is-welcome"}`}
    >
      <header className="chat-heading">
        <div>
          <span className="eyebrow">TANYA & PAHAMI</span>
          <h2>
            <MessageCircle size={24} /> Asisten AI
          </h2>
        </div>
        <button
          className="outline-button"
          disabled={busy || !messages.length}
          onClick={() => {
            setMessages([]);
            setError("");
            setStopped(false);
            setInput("");
            textarea.current?.focus();
          }}
        >
          <Plus size={16} /> Percakapan baru
        </button>
      </header>
      {!messages.length ? (
        <>
          <section className="chat-welcome">
            <h3>Mulai dari yang ingin kamu pahami.</h3>
            <p>
              Asisten Siaga membantu membaca indikator risiko dan menyiapkan
              langkah keluarga. Jawaban AI bisa keliru; arahan resmi tetap jadi
              acuan.
            </p>
          </section>
          <div className="chat-welcome-grid">
            <section className="chat-context">
              <span className="eyebrow">KONTEKS SAAT INI</span>
              <h3>{context.region}</h3>
              <p>{context.period}</p>
              <small>{context.coverage}</small>
              <div className="chat-tags">
                <span>{context.level}</span>
                <span>{context.source}</span>
                {context.score !== null && (
                  <span>Indikator {context.score}/100</span>
                )}
              </div>
              <button
                className="outline-button"
                disabled={!available}
                onClick={() =>
                  ask("Jelaskan skor risiko wilayah yang sedang saya pilih")
                }
              >
                Tanyakan tentang ini <ArrowUpRight size={16} />
              </button>
            </section>
            <section className="chat-fact">
              <span className="eyebrow">TAHUKAH KAMU?</span>
              <p>{facts[fact]}</p>
              <button onClick={() => setFact((f) => (f + 1) % facts.length)}>
                Fakta berikutnya →
              </button>
            </section>
          </div>
          {suggestions}
          <section className="chat-how">
            <h3>Cara asisten menjawab</h3>
            <p>
              Menggunakan wilayah, periode, indikator, faktor skor, dan cakupan
              yang sedang dipilih. Tidak menerima titik hotspot mentah atau
              lokasi presisimu.
            </p>
            <button onClick={() => onNavigate("map")}>
              Buka Peta aktivitas →
            </button>
            <button onClick={() => onNavigate("data")}>
              Lihat Data & analitik →
            </button>
          </section>
          <section className="chat-faq" aria-label="Pertanyaan umum">
            {faq.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </section>
        </>
      ) : (
        <>
          <details className="chat-suggestions">
            <summary>Saran pertanyaan</summary>
            {suggestions}
          </details>
          <div
            className="chat-messages"
            ref={scroller}
            onScroll={(e) => {
              const el = e.currentTarget;
              nearBottom.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            role="log"
            aria-label="Percakapan dengan Asisten Siaga"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {messages.map((m, i) => (
              <article className={`chat-message ${m.role}`} key={i}>
                <small>{m.role === "user" ? "Kamu" : "Asisten Siaga"}</small>
                <SafeAnswer
                  text={
                    m.content ||
                    (busy ? "Sedang menyusun jawaban…" : "Belum ada jawaban.")
                  }
                />
                {m.role === "assistant" && m.content && (
                  <button
                    className="chat-copy"
                    onClick={() => {
                      void navigator.clipboard
                        ?.writeText(m.content)
                        .then(() => setCopied(i))
                        .catch(() =>
                          setError(
                            "Teks belum dapat disalin. Silakan pilih teks secara manual.",
                          ),
                        );
                    }}
                    aria-label="Salin jawaban"
                  >
                    {copied === i ? <Check size={14} /> : <Copy size={14} />}{" "}
                    {copied === i ? "Tersalin" : "Salin"}
                  </button>
                )}
              </article>
            ))}
          </div>
          {!busy && (
            <div className="chat-followups">
              {[
                context.level === "Siaga"
                  ? "Apa yang harus saya siapkan sekarang?"
                  : "Jelaskan dengan bahasa yang lebih sederhana",
                "Apa batas informasi ini?",
              ].map((p) => (
                <button disabled={!available} key={p} onClick={() => ask(p)}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <p className="chat-emergency">
        Dalam bahaya, ikuti arahan BPBD/pemerintah setempat. Hubungi 112 bila
        layanan aktif di daerahmu; jangan menunggu jawaban AI.
      </p>
      <div className="chat-composer">
        {available === false && (
          <div role="status">
            <strong>Asisten AI sedang tidak tersedia.</strong> Pertanyaan umum
            di atas tetap bisa dibaca.{" "}
            <button
              onClick={() => {
                setAvailable(null);
                setCheckVersion((v) => v + 1);
              }}
            >
              Periksa lagi
            </button>
          </div>
        )}
        {error && (
          <p role="alert">
            {error}{" "}
            {available && lastQuestion && (
              <button onClick={() => void send(lastQuestion, true)}>
                Coba lagi
              </button>
            )}
          </p>
        )}
        {stopped && !error && (
          <p role="status">
            Jawaban dihentikan.{" "}
            {available && lastQuestion && (
              <button onClick={() => void send(lastQuestion, true)}>
                Coba lagi
              </button>
            )}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <label className="sr-only" htmlFor="chat-input">
            Pesan untuk Asisten Siaga
          </label>
          <textarea
            id="chat-input"
            ref={textarea}
            value={input}
            maxLength={MAX_MESSAGE_CHARS}
            disabled={!available || busy}
            rows={2}
            placeholder={
              available === null
                ? "Memeriksa ketersediaan…"
                : available
                  ? "Tulis pertanyaanmu…"
                  : "Asisten AI sedang tidak tersedia."
            }
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          {busy ? (
            <button
              type="button"
              onClick={() => controller.current?.abort()}
              aria-label="Hentikan jawaban"
            >
              <Square size={18} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!available || !input.trim()}
              aria-label="Kirim pesan"
            >
              <ArrowUp size={20} />
            </button>
          )}
        </form>
        <div className="chat-input-hint">
          <span>Enter untuk kirim · Shift+Enter untuk baris baru</span>
          <span>
            {input.length}/{MAX_MESSAGE_CHARS}
          </span>
        </div>
        <p className="chat-notice">
          Dijawab oleh AI (Groq) dan bisa keliru. Bukan sumber resmi
          BNPB/BPBD/NASA. Jangan kirim data pribadi. Pesan dan konteks ringkas
          dikirim melalui server aplikasi ke Groq. Percakapan hanya disimpan di
          memori halaman ini.
        </p>
      </div>
    </div>
  );
}
