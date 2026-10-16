import { loadEnv } from "vite";
import type { Plugin, Connect } from "vite";
import { createChatHandler } from "./chat";
export function chatPlugin(): Plugin {
  let mode = "development";
  const setup = (middlewares: Connect.Server) => {
    // Consumed only by Node middleware; never injected via define/import.meta.env.
    const local = loadEnv(mode, process.cwd(), "GROQ_");
    const handler = createChatHandler({
      env: () => ({
        GROQ_API_KEY: process.env.GROQ_API_KEY ?? local.GROQ_API_KEY,
        GROQ_MODEL: process.env.GROQ_MODEL ?? local.GROQ_MODEL,
      }),
    });
    middlewares.use("/api/chat", (req, res) => {
      void handler(req, res);
    });
  };
  return {
    name: "siaga-chat-server",
    configResolved(config) {
      mode = config.mode;
    },
    configureServer(server) {
      setup(server.middlewares);
    },
    configurePreviewServer(server) {
      setup(server.middlewares);
    },
  };
}
