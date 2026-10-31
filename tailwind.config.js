/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#202124',
        rail: '#1C1D1F',
        kds: '#111214',
        cream: '#F7F5F0',
        paper: '#ECE8E1',
        line: '#E5E1DA',
        muted: '#6B6760',
        soft: '#55524C',
        // Brand accent comes from Settings › Business & brand (CSS variable set at runtime)
        accent: 'var(--accent)',
        ok: '#2F855A',
        okbg: '#E6F2EB',
        warn: '#D69E2E',
        warnbg: '#FBF1DB',
        danger: '#B83A3A',
        dangerbg: '#FBE9E9',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
