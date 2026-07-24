import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#f8fafc",
        foreground: "#0f172a",
        primary: {
          DEFAULT: "#0f766e",
          foreground: "#f8fafc",
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        secondary: {
          DEFAULT: "#e2e8f0",
          foreground: "#0f172a",
        },
        muted: {
          DEFAULT: "#f1f5f9",
          foreground: "#475569",
        },
        border: "#cbd5e1",
        accent: "#dcfce7",
        danger: "#fee2e2",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.08)",
        "soft-lg": "0 20px 50px rgba(15, 23, 42, 0.12)",
        glow: "0 0 40px rgba(15, 118, 110, 0.25)",
      },
      backgroundImage: {
        "login-hero":
          "radial-gradient(ellipse 80% 60% at 20% 30%, rgba(45, 212, 191, 0.35), transparent), radial-gradient(ellipse 60% 50% at 80% 70%, rgba(14, 116, 144, 0.4), transparent), linear-gradient(160deg, #0f766e 0%, #134e4a 45%, #0f172a 100%)",
        "grid-pattern":
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "40px 40px",
      },
    },
  },
  plugins: [],
};

export default config;
