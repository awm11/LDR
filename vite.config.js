import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this project from /ldr-thermistor/ (the repo name), so the
// build needs that prefix. Local dev stays at "/" so `npm run dev` just
// works. `command` is "serve" for `npm run dev`, "build" for `npm run build`.
const REPO_NAME = "ldr-thermistor";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? `/${REPO_NAME}/` : "/",
}));
