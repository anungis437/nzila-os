import { defineProject } from "vitest/config";
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path'

export default defineProject({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    name: "abr",
    include: [
      '**/*.test.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
      '**/*.spec.{ts,tsx,js,jsx,mts,cts,cjs}',
    ],
    exclude: [
      'e2e/**',
      '**/*.spec.mjs',
      'artifacts/**',
      '.next/**',
      'node_modules/**',
    ],
    environmentMatchGlobs: [
      ['**/*.test.tsx', 'jsdom'],
    ],
    coverage: {
      provider: 'v8',
      include: [
        'lib/org-context.ts',
        'lib/api-guards.ts',
        'app/api/isolation-proof/route.ts',
      ],
      exclude: ['**/*.test.ts', '**/*.test.tsx'],
      thresholds: {
        lines: 99,
        functions: 99,
        branches: 99,
        statements: 99,
      },
    },
  },
} as unknown as Parameters<typeof defineProject>[0]);
