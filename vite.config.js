import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // expose on local network for mobile testing
    port: 5173,
    strictPort: true,
  },
});
