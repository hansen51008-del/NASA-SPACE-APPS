import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { chatPlugin } from "./server/viteChat";
export default defineConfig({ plugins: [react(), chatPlugin()] });
