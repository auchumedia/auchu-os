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
        // AuchuOS brand palette — style Notion (noir / blanc / gris)
        auchu: {
          50:  '#f5f5f5',
          100: '#ececec',
          200: '#e0e0e0',
          300: '#c7c7c7',
          400: '#a0a0a0',
          500: '#1a1a1a',  // primary
          600: '#0d0d0d',
          700: '#000000',
          800: '#000000',
          900: '#000000',
          950: '#000000',
        },
        // Palette grise Notion — remplace l'échelle gray par défaut de Tailwind.
        gray: {
          50:  '#f5f5f5',
          100: '#f0f0f0',
          200: '#e0e0e0',
          300: '#c7c7c7',
          400: '#a3a3a3',
          500: '#6b6b6b',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#1a1a1a',
          950: '#0d0d0d',
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
