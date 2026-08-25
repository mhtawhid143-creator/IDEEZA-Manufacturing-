const preset = require('@ideeza/ui/tailwind-preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: [
    './src/**/*.{ts,tsx}',
    // The design system components ship as source, so their classes are scanned
    // from here rather than being duplicated into a build step.
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
};
