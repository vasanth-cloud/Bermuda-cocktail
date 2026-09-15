/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bermuda: {
          dark: '#0f172a',
          card: '#1e293b',
          gold: '#f59e0b',
          amber: '#d97706',
          teal: '#14b8a6',
          rose: '#f43f5e',
          accent: '#8b5cf6'
        }
      }
    },
  },
  plugins: [],
}
