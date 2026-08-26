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
    // React component tests use jsdom and testing-library waitFor loops; under
    // monorepo-scale parallel runners on Windows, cold jsdom + async click
    // handlers can exceed the 5s vitest default. 30s gives comfortable headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
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
