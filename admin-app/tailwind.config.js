/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#F05A32',
        'primary-dark': '#DD4723',
        coral: '#E94B35',
        cream: '#FAF7F2',
        ink: '#252525',
        muted: '#777777',
        success: '#43A66A',
        warning: '#EAB544',
        peach: '#FFF0E8',
        line: '#EEE9E2',
        'soft-ink': '#4A4845',
        'soft-green': '#EDF8F1',
        'soft-yellow': '#FDF6E6',
        'soft-red': '#FDEDEC',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 14px 40px -28px rgba(37, 37, 37, 0.28)',
        float: '0 22px 60px -30px rgba(37, 37, 37, 0.38)',
        soft: '0 6px 20px -12px rgba(37, 37, 37, 0.18)',
      },
      borderRadius: {
        xl: '14px',
        '2xl': '16px',
        '3xl': '20px',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-in': { '0%': { opacity: '0', transform: 'translateX(12px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
      },
      animation: {
        'fade-in': 'fade-in .35s ease both',
        'slide-in': 'slide-in .3s ease both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}
