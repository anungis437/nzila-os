import type { Config } from 'tailwindcss';

/**
 * Tailwind v4 uses CSS-based configuration; this file is retained so
 * IDE tooling can locate a content root and for parity with the op
 * app. Keep it minimal.
 */
const config = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/union-eyes-ui/src/**/*.{ts,tsx}',
  ],
  theme: { extend: {} },
} satisfies Config;

export default config;
