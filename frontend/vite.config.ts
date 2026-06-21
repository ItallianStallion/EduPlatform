import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
//
// Бекенд (див. EduPlatform_API_Documentation) очікує CORS_ORIGIN=http://localhost:5173
// і працює напряму на http://localhost:3000 — тому фронтенд звертається до нього
// абсолютним URL (VITE_API_BASE_URL) з withCredentials: true, без dev-проксі.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
