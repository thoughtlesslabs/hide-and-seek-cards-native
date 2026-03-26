import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        cinzel: ["Cinzel_400Regular"],
        "cinzel-bold": ["Cinzel_700Bold"],
      },
      colors: {
        game: {
          bg: "#1c0a00",
          amber: "#b45309",
          gold: "#d97706",
          dark: "#0c0a09",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
