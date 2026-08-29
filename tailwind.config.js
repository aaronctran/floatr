/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './options.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#090d14',
        'bg-secondary': '#0f1520',
        'bg-card': '#141a28',
        'text-primary': '#f0f4f8',
        'text-secondary': '#94a3b8',
        'text-muted': '#64748b',
        'accent-blue': '#3b82f6',
        'accent-blue-hover': '#60a5fa',
        'accent-green': '#22c55e',
        'accent-amber': '#f59e0b',
        'accent-red': '#ef4444',
      },
      borderRadius: {
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
      }
    },
  },
  plugins: [],
}
