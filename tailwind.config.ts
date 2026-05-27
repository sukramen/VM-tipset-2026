import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui"],
      },
      colors: {
        pitch: "#06130f",
        flood: "#08251f",
        volt: "#7CFF6B",
        cyan: "#55D6FF",
        flare: "#FFB84D",
        coral: "#FF5C7A",
      },
      boxShadow: {
        glow: "0 0 45px rgba(124,255,107,0.18)",
        cyan: "0 0 40px rgba(85,214,255,0.18)",
      },
      backgroundImage: {
        grid:
          "linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

export default config;
