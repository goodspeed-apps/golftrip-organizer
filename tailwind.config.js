const { gasConfig } = require('./gas.config');
const c = gasConfig.design.colors;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: c.primary, dark: c.primaryDark },
        secondary: c.secondary,
        accent: c.accent,
        background: { DEFAULT: c.background, dark: c.backgroundDark },
        surface: { DEFAULT: c.surface, dark: c.surfaceDark },
        content: {
          DEFAULT: c.text,
          dark: c.textDark,
          muted: c.textSecondary,
          mutedDark: c.textSecondaryDark,
        },
        border: { DEFAULT: c.border, dark: c.borderDark },
        success: c.success,
        warning: c.warning,
        error: c.error,
      },
    },
  },
  plugins: [],
};
