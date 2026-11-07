/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#F47721',
          dark: '#C84F0A',
          black: '#000000',
          charcoal: '#171614',
          cream: '#FFF8EF',
          white: '#FFFFFF',
          muted: '#716B63',
          line: '#E9E3DA',
          success: '#18794E',
          warning: '#B54708',
          error: '#B42318',
        },
      },
      fontFamily: {
        display: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.75rem',
        '6xl': '3.5rem',
      },
      boxShadow: {
        soft: '0 18px 60px -24px rgba(23, 22, 20, 0.24)',
        card: '0 10px 40px -18px rgba(23, 22, 20, 0.18)',
        glow: '0 20px 80px -24px rgba(244, 119, 33, 0.55)',
      },
      maxWidth: {
        '8xl': '90rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'soft-pulse': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.04)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        'soft-pulse': 'soft-pulse 5s ease-in-out infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
