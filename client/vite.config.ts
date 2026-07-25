import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:3420",
      "/healthz": "http://localhost:3420",
      "/exercise-images": "http://localhost:3420",
    },
  },
});
