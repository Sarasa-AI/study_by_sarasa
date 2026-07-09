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
      borderRadius: {
        xl: "1rem",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
