import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#05070a",
        control: "#0c1017",
        panel: "#111722",
        panelAlt: "#161f2e",
        cyan: "#66d7ff",
        amber: "#ffc857",
        coral: "#ff7f6a",
        lime: "#a8ff96",
      },
      fontFamily: {
        display: ["'Archivo Black'", "sans-serif"],
        body: ["'IBM Plex Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        neon: "0 0 0 1px rgba(102, 215, 255, 0.18), 0 20px 60px rgba(2, 8, 23, 0.45)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(102, 215, 255, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(102, 215, 255, 0.06) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
} satisfies Config;
