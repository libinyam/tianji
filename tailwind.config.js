/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        lg: "1.5rem",
      },
    },
    extend: {
      colors: {
        // 底色（通过 CSS 变量实现深/浅切换）
        void: {
          950: "var(--c-void-950)",
          900: "var(--c-void-900)",
          800: "var(--c-void-800)",
          700: "var(--c-void-700)",
          600: "var(--c-void-600)",
        },
        // 琥珀点缀色
        star: {
          50: "var(--c-star-50)",
          100: "var(--c-star-100)",
          200: "var(--c-star-200)",
          300: "var(--c-star-300)",
          400: "var(--c-star-400)",
          500: "var(--c-star-500)",
          600: "var(--c-star-600)",
          700: "var(--c-star-700)",
        },
        // 主强调蓝
        tian: {
          50: "var(--c-tian-50)",
          100: "var(--c-tian-100)",
          200: "var(--c-tian-200)",
          300: "var(--c-tian-300)",
          400: "var(--c-tian-400)",
          500: "var(--c-tian-500)",
          600: "var(--c-tian-600)",
        },
        // 文字主色
        parchment: {
          50: "var(--c-parchment-50)",
          100: "var(--c-parchment-100)",
          200: "var(--c-parchment-200)",
          300: "var(--c-parchment-300)",
        },
        // 次要文字
        mist: {
          300: "var(--c-mist-300)",
          400: "var(--c-mist-400)",
          500: "var(--c-mist-500)",
        },
      },
      fontFamily: {
        display: ["var(--font-sans)"],
        sans: ["var(--font-sans)"],
        content: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      boxShadow: {
        card: "var(--shadow-card)",
      },
    },
  },
  plugins: [],
};
