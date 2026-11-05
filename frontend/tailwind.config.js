/** @type {import('tailwindcss').Config} */

// Brand accent comes from CSS variables (see src/index.css) so every `gold-*`
// class automatically switches between the warm orange (light theme) and the
// gold (dark theme) with correct contrast, and opacity modifiers (`/20`) work.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
    },
    extend: {
      colors: {
        // Warm neutral (stone) greys replace Tailwind's blue-tinted default everywhere
        gray: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#2c2825',
          900: '#1f1c1a',
          950: '#151311',
        },
        gold: {
          50: token('gold-50'),
          100: token('gold-100'),
          200: token('gold-200'),
          300: token('gold-300'),
          400: token('gold-400'),
          500: token('gold-500'),
          600: token('gold-600'),
          700: token('gold-700'),
          800: token('gold-800'),
          900: token('gold-900'),
        },
        'on-gold': token('on-gold'),
        surface: {
          DEFAULT: token('surface'),
          muted: token('surface-muted'),
          raised: token('surface-raised'),
        },
      },
      fontFamily: {
        sans: ['Cairo', 'Tajawal', 'Segoe UI', 'Tahoma', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        'card-hover': '0 10px 30px -10px rgb(0 0 0 / 0.18)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      screens: {
        xs: '420px',
        '3xl': '1680px',
      },
      keyframes: {
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(-100%)' },
        },
        'cta-drift': {
          from: { transform: 'translate(0, 0) scale(1)' },
          to: { transform: 'translate(28px, 18px) scale(1.12)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.4s ease-out both',
        'cta-drift': 'cta-drift 16s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};
