/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/**/*.{html,js}'],
  theme: {
    extend: {
      colors: {
        primary: '#0d631b',
        'primary-container': '#2e7d32',
        'on-primary': '#ffffff',
        secondary: '#964900',
        'secondary-container': '#fc820c',
        tertiary: '#00569f',
        'tertiary-container': '#006eca',
        background: '#f9f9f9',
        surface: '#ffffff',
        'surface-container': '#eeeeee',
        'surface-container-low': '#f3f3f3',
        'outline-variant': '#bfcaba',
        error: '#ba1a1a',
        'error-container': '#ffdad6'
      }
    }
  },
  plugins: [require('@tailwindcss/forms')]
};
