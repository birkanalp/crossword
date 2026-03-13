import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './contexts/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': '#0f0f14',
        'bg-surface': '#1a1a22',
        'bg-elevated': '#22222c',
        'bg-active': '#2a3a4a',
        border: '#2a2a35',
        'border-focus': '#6b9fff',
        'border-hover': '#3a3a48',
        'text-primary': '#e8e8ed',
        'text-secondary': '#a0a0b0',
        'text-tertiary': '#6a6a7a',
        accent: '#6b9fff',
        'accent-dark': '#1e3a5f',
        'accent-border': '#2a4a7f',
        success: '#16a34a',
        'success-bg': '#0d3d0d',
        'success-border': '#1a5c1a',
        error: '#dc2626',
        'error-bg': '#3d0d0d',
        'error-border': '#5c1a1a',
        warning: '#d97706',
        'warning-bg': '#3d3d00',
        'warning-border': '#5c5c00',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
