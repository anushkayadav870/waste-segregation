import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Preserve the default sky scale for -50, -100, etc., while adding custom tones.
        sky: colors.sky,
        ink: '#0f172a',
        mist: '#e2e8f0',
        mint: '#10b981',
      },
      boxShadow: {
        card: '0 10px 30px -15px rgba(2, 6, 23, 0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
