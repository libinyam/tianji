/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1.5rem",
        lg: "2.5rem",
        xl: "3.5rem",
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
        // 星芒暖金
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
        // 天玑冷蓝
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
        display: ['Fraunces', '"Noto Serif SC"', 'serif'],
        sans: ['"Spline Sans"', '"Noto Sans SC"', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
      backgroundImage: {
        'void-radial': 'var(--bg-void-radial)',
        'gold-sheen':
          'linear-gradient(135deg, #f3c969 0%, #e9b865 50%, #d29f3f 100%)',
        'star-glow':
          'radial-gradient(circle, rgba(243,201,105,0.45) 0%, rgba(243,201,105,0) 70%)',
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(243,201,105,0.35)',
        'glow-blue': '0 0 28px -6px rgba(124,196,255,0.4)',
        card: 'var(--shadow-card)',
      },
      keyframes: {
        twinkle: {
          '0%, 100%': { opacity: '0.2' },
          '50%': { opacity: '1' },
        },
        drift: {
          '0%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
          '100%': { transform: 'translateY(0px)' },
        },
        'draw-line': {
          '0%': { strokeDashoffset: '320' },
          '100%': { strokeDashoffset: '0' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.15)' },
        },
      },
      animation: {
        twinkle: 'twinkle 4s ease-in-out infinite',
        drift: 'drift 6s ease-in-out infinite',
        'draw-line': 'draw-line 3s ease forwards',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
