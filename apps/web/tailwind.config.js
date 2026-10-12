/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        heading: ['var(--font-heading)', 'Plus Jakarta Sans', '-apple-system', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        vault: {
          bg: '#faf6ef',
          surface: '#fffdf9',
          card: '#fffdf9',
          border: '#e6dccb',
          'border-hover': '#cfc2ab',
          ink: '#1c2621',
          muted: '#4a564f',
          subtle: '#7d877f',
          spruce: '#1f4d3a',
          'spruce-dark': '#163828',
          sage: '#5b7f6a',
          'sage-light': '#dfeae3',
          terracotta: '#c2512f',
          'terracotta-dark': '#9d3f22',
          'terracotta-light': '#f8e4db',
          amber: '#b97d10',
        },
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
        'glow-cyan': '0 0 25px -4px rgba(6, 182, 212, 0.35)',
        'glow-emerald': '0 0 25px -4px rgba(16, 185, 129, 0.35)',
        'glow-rose': '0 0 25px -4px rgba(244, 63, 94, 0.35)',
        'card-inner': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
