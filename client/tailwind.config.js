/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff8f7',
          100: '#d7ecea',
          200: '#aed9d5',
          300: '#7cc0ba',
          400: '#4ba39c',
          500: '#308781',
          600: '#236b68',
          700: '#1e5654',
          800: '#1c4644',
          900: '#193b3a',
          950: '#092220',
        },
      },
      fontFamily: {
        sans: [
          'Inter var',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 4px 16px -4px rgb(15 23 42 / 0.10)',
        'card-hover': '0 2px 4px 0 rgb(15 23 42 / 0.05), 0 12px 28px -8px rgb(15 23 42 / 0.18)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.25s ease-out both',
      },
    },
  },
  plugins: [],
};
