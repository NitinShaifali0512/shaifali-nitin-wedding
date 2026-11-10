/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Taken from the printed invitation card.
        wine: {
          950: '#34061F',
          900: '#450829',
          800: '#570A34', // arch panel on the card
          700: '#6A0A3F', // card background
          600: '#821650',
          500: '#9B2F66',
        },
        rose: {
          700: '#8E4A66',
          500: '#B06783', // medallion petals on the card
          300: '#E699A3', // monogram on the card
          200: '#F1C2C6',
          100: '#F8E1DF',
          50: '#FCF1EE',
        },
        cream: {
          DEFAULT: '#FFE3BE', // lettering on the card
          200: '#FFEFD9',
        },
        ivory: {
          DEFAULT: '#FBF5EA',
          200: '#F5EAD8',
          300: '#EBDCC3',
        },
        gold: {
          300: '#E6CB98',
          400: '#D4B170',
          500: '#C29A52',
          700: '#8A6626', // readable on ivory
        },
        ink: {
          DEFAULT: '#3B2530',
          soft: '#6B5560',
        },
      },
      fontFamily: {
        display: ['"Cinzel Decorative"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', '"Times New Roman"', 'serif'],
        sans: ['Montserrat', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        deva: ['"Tiro Devanagari Sanskrit"', '"Noto Serif Devanagari"', '"Kohinoor Devanagari"', '"Nirmala UI"', 'serif'],
      },
      letterSpacing: {
        label: '0.22em',
        wide2: '0.32em',
      },
      boxShadow: {
        card: '0 18px 50px -22px rgba(69, 8, 41, 0.45)',
        photo: '0 14px 30px -14px rgba(59, 37, 48, 0.55)',
        soft: '0 8px 30px -12px rgba(69, 8, 41, 0.25)',
      },
      maxWidth: {
        content: '68rem',
      },
    },
  },
  plugins: [],
};
