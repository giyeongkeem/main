import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Pretendard", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#0f1115",
        panel: "#171a21",
        edge: "#262b36",
      },
    },
  },
  plugins: [],
};

export default config;
