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
          50: "#FFF4EC",
          100: "#FFE3CC",
          200: "#FFC299",
          300: "#FFA266",
          400: "#FF8533", // highlight
          500: "#FF6B00", // primary accent — pure vivid orange
          600: "#DB5B00",
          700: "#B34A00",
          800: "#8A3900",
          900: "#5C2600",
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
          "repeating-linear-gradient(135deg, rgba(255,107,0,0.05) 0 1px, transparent 1px 14px)",
      },
      letterSpacing: {
        mono: "0.08em",
      },
      animation: {
        marquee: "marquee 30s linear infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
