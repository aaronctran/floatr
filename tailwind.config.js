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
        'on-accent': 'rgb(var(--on-accent, 255 255 255) / <alpha-value>)',
        'ui-border': 'rgb(var(--ui-border, 255 255 255) / <alpha-value>)',
        'ui-overlay': 'rgb(var(--ui-overlay, 255 255 255) / <alpha-value>)',
        'bg-primary': 'rgb(var(--bg-primary, 9 13 20) / <alpha-value>)',
        'bg-secondary': 'rgb(var(--bg-secondary, 15 21 32) / <alpha-value>)',
        'bg-card': 'rgb(var(--bg-card, 20 26 40) / <alpha-value>)',
        'text-primary': 'rgb(var(--text-primary, 240 244 248) / <alpha-value>)',
        'text-secondary': 'rgb(var(--text-secondary, 148 163 184) / <alpha-value>)',
        'text-muted': 'rgb(var(--text-muted, 148 163 184) / <alpha-value>)',
        'accent-blue': 'rgb(var(--accent-blue, 59 130 246) / <alpha-value>)',
        'accent-blue-hover': 'rgb(var(--accent-blue-hover, 96 165 250) / <alpha-value>)',
        'accent-green': 'rgb(var(--accent-green, 34 197 94) / <alpha-value>)',
        'accent-amber': 'rgb(var(--accent-amber, 245 158 11) / <alpha-value>)',
        'accent-red': 'rgb(var(--accent-red, 239 68 68) / <alpha-value>)',
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
