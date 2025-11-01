// Central API base
// In production (e.g., Vercel), set VITE_API_BASE="https://your-backend.onrender.com"
// In development, falls back to http://<host>:8080 for LAN/mobile testing.
export const API_BASE = (() => {
  try {
    const envBase =
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_API_BASE;
    if (envBase) return envBase;
    const host = (typeof window !== "undefined" && window.location.hostname) || "localhost";
    return `http://${host}:8080`;
  } catch {
    return "http://localhost:8080";
  }
})();
