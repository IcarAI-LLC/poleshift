export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
  theme: {
      fontFamily: {
        // Matches MUI's "Roboto, sans-serif"
        sans: ['Roboto', 'sans-serif'],
      },
      colors: {
        // Replicating MUI palette
        primary: {
          DEFAULT: '#6200ee',
          light: '#8F3AFF',
          dark: '#3700b3',
        },
        secondary: {
          DEFAULT: '#03DAC6',
          light: '#66FFF8',
          dark: '#00A896',
        },
        background: {
          DEFAULT: '#121212', // same as background.default
          paper: '#1a1a1a',   // same as background.paper
        },
        error: {
          DEFAULT: '#CF6679',
        },
        text: {
          primary: '#e0e0e0',
          secondary: '#b0b0b0',
        },
        action: {
          hover: 'rgba(255, 255, 255, 0.05)',
          selected: 'rgba(255, 255, 255, 0.08)',
        },
        divider: 'rgba(255, 255, 255, 0.1)',
      },
    },
}
