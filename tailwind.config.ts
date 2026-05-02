import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Direction A — "Indústria" palette
        navy: {
          DEFAULT: "#0A1628",
          800: "#152340",
          700: "#1E3050",
          600: "#2A4060",
        },
        ink: {
          DEFAULT: "#0F1F3D",
          2: "#475569",
        },
        bone: {
          DEFAULT: "#F4F2EE",
          2: "#E8E5DE",
        },
        line: "#D6D2C9",
        brand: {
          50: "#FFF1E8",
          100: "#FFD9C2",
          200: "#FFB48C",
          300: "#FF9359",
          400: "#FF7A33", // orange2 — highlight
          500: "#E8682A", // orange — primary accent
          600: "#CC5A24",
          700: "#A8491E",
          800: "#7E3818",
          900: "#5C2911",
        },
        ok: "#15803D",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-archivo-black)", "Impact", "sans-serif"],
        mono: [
          "var(--font-jetbrains)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      backgroundImage: {
        "hatch-light":
          "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 14px)",
        "hatch-orange":
          "repeating-linear-gradient(135deg, rgba(232,104,42,0.05) 0 1px, transparent 1px 14px)",
      },
      letterSpacing: {
        mono: "0.08em",
      },
    },
  },
  plugins: [],
} satisfies Config;
