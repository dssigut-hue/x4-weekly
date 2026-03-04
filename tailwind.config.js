/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["'IBM Plex Mono'", "monospace"],
        sans: ["'IBM Plex Sans'", "sans-serif"],
      },
      colors: {
        ink: "#0a0a0f",
        paper: "#f5f3ee",
        accent: "#e84830",
        muted: "#8a8a8a",
        border: "#d0cdc7",
      },
    },
  },
  plugins: [],
};
