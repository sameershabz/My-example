/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"], // ✅ matches your project structure
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Helvetica', 'Arial', 'sans-serif'],
      },
      keyframes: {
        "gradient-x": {
          "0%, 100%": { "backgroundPosition": "0% 50%" },
          "50%": { "backgroundPosition": "100% 50%" },
        },
      },
      animation: {
        "gradient-x": "gradient-x 10s ease infinite",
      },
      backgroundSize: {
        '400': '400% 400%',
      },
    },
  },
  plugins: [],
};
