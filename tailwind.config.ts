import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // AuchuOS brand palette
        auchu: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d6fe',
          300: '#a5b8fc',
          400: '#8090f8',
          500: '#6366f1',  // primary
          600: '#4f46e5',
          700: '#4038ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        coral: {
          50:  '#fff4f2',
          100: '#ffe4de',
          200: '#ffcdc3',
          300: '#ffa899',
          400: '#ff7a68',
          500: '#f95640',  // accent
          600: '#e63520',
          700: '#c22616',
          800: '#a02317',
          900: '#84231a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
}

export default config
