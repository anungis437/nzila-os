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
    coverage: {
      provider: 'v8',
      include: [
        'app/api/health/route.ts',
        'app/api/ready/route.ts',
        'app/api/version/route.ts',
      ],
      exclude: ['**/*.test.ts', '**/*.test.tsx'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 99,
        branches: 75,
      },
    },
  },
});
