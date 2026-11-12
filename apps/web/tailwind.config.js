/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'Outfit', 'Plus Jakarta Sans', 'sans-serif'],
      },
      colors: {
        brand: {
          bg: '#0a0f1d',
          card: '#111827',
          surface: '#1e293b',
          border: '#334155',
          primary: '#1e40af',
          primaryHover: '#1d4ed8',
          accent: '#0284c7',
          emerald: '#059669',
          amber: '#d97706',
          gold: '#f59e0b',
          danger: '#dc2626',
        },
      },
    },
  },
  plugins: [],
};
