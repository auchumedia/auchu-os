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
        // AuchuOS brand palette — bleu royal AuchuMedia (voir site vitrine :
        // Nav.js / Home.js, const BLUE = '#003DA5'). Remplace l'ancienne
        // échelle noire : tout ce qui utilisait auchu-* (boutons, liens,
        // badges, focus rings, onglets actifs) devient bleu automatiquement.
        auchu: {
          50:  '#EEF3FC',
          100: '#DCE6F9',
          200: '#B9CDF3',
          300: '#86ABEA',
          400: '#4D82DD',
          500: '#003DA5',  // primary
          600: '#002D7A',  // primary-dark (hover)
          700: '#002060',  // active/pressed
          800: '#001747',
          900: '#000F30',
          950: '#000819',
        },
        // Tokens nommés — mêmes valeurs que la palette ci-dessus, exposés
        // sous des noms sémantiques pour le reste du thème.
        primary: {
          DEFAULT: '#003DA5',
          dark:    '#002D7A',
        },
        ink:        '#0A0A0A',
        surface:    '#FFFFFF',
        background: '#F6F7FB',
        'border-soft': 'rgba(10,10,10,0.08)',
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
        sans:    ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-bebas)', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
}

export default config
