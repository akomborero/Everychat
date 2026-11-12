import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Meta's popup only works on HTTPS domains, so during development you reach the dev server through an
  // HTTPS tunnel (ngrok, Cloudflare Tunnel). These hosts are allowed for that. Dev server only.
  server: { allowedHosts: [".ngrok-free.app", ".ngrok-free.dev", ".ngrok.app", ".ngrok.io", ".trycloudflare.com", ".loca.lt"] },
});
