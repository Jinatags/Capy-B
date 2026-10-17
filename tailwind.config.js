/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF6E8',
        cocoa: '#5C3A2E',
        blush: '#F4B8A8'
      },
      keyframes: {
        'bubble-in': {
          '0%': { opacity: '0', transform: 'translate(-50%, 8px) scale(0.92)' },
          '100%': { opacity: '1', transform: 'translate(-50%, 0) scale(1)' }
        },
        'bubble-out': {
          '0%': { opacity: '1', transform: 'translate(-50%, 0) scale(1)' },
          '100%': { opacity: '0', transform: 'translate(-50%, -6px) scale(0.96)' }
        }
      },
      animation: {
        'bubble-in': 'bubble-in 220ms ease-out forwards',
        'bubble-out': 'bubble-out 280ms ease-in forwards'
      }
    }
  },
  plugins: []
}
