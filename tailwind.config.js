export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Segoe UI", "Arial", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#e50914",
          dark: "#b20710",
        },
        secondary: {
          DEFAULT: "#1f1f1f",
        },
        accent: {
          DEFAULT: "#f5c518",
        },
        background: {
          DEFAULT: "#121212",
        },
      },
      boxShadow: {
        card: "0 4px 24px 0 rgba(0,0,0,0.12)",
      },
    },
  },
  plugins: [],
};
