import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname),
    },
  },
  test: {
    name: 'zonga',
    environment: 'node',
    include: ['**/*.test.{ts,tsx}'],
  },
});
