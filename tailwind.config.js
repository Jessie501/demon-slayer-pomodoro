/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ds-dark': '#121212',
        'ds-red': '#8b0000',
        'ds-gold': '#ffd700',
        'ds-blue': '#1e3a8a',
        'ds-accent': '#e5e7eb',
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
