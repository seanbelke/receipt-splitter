import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        sand: "#f8f7f3",
        accent: "#0f766e",
        coral: "#ea580c"
      }
    }
  },
  plugins: []
};

export default config;
