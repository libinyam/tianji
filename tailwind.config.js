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
        // 深空墨蓝底色
        void: {
          950: "#060914",
          900: "#0a0f2c",
          800: "#0d1538",
          700: "#131d4a",
          600: "#1b275e",
        },
        // 星芒暖金
        star: {
          50: "#fdf6e3",
          100: "#f9ecc2",
          200: "#f3dd96",
          300: "#eccd6b",
          400: "#e9b865",
          500: "#f3c969",
          600: "#d29f3f",
          700: "#a87a2e",
        },
        // 天玑冷蓝
        tian: {
          50: "#eaf6ff",
          100: "#cfe9ff",
          200: "#a8d6ff",
          300: "#7cc4ff",
          400: "#5aa6f0",
          500: "#3d86d6",
          600: "#2b66ab",
        },
        // 暖白羊皮纸
        parchment: {
          50: "#fbf8f0",
          100: "#f5efe1",
          200: "#f1ede2",
          300: "#e3dcc8",
        },
        // 次要灰蓝文字
        mist: {
          300: "#b8c0db",
          400: "#9aa3c4",
          500: "#76809f",
        },
      },
      fontFamily: {
        display: ['Fraunces', '"Noto Serif SC"', 'serif'],
        sans: ['"Spline Sans"', '"Noto Sans SC"', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
      backgroundImage: {
        'void-radial':
          'radial-gradient(ellipse at 50% -10%, rgba(27,39,94,0.55) 0%, rgba(10,15,44,0.9) 45%, #060914 100%)',
        'gold-sheen':
          'linear-gradient(135deg, #f3c969 0%, #e9b865 50%, #d29f3f 100%)',
        'star-glow':
          'radial-gradient(circle, rgba(243,201,105,0.45) 0%, rgba(243,201,105,0) 70%)',
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(243,201,105,0.35)',
        'glow-blue': '0 0 28px -6px rgba(124,196,255,0.4)',
        card: '0 18px 40px -20px rgba(0,0,0,0.7)',
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
