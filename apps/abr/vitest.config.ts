import { defineProject } from "vitest/config";
import { resolve } from 'node:path'

export default defineProject({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    name: "abr",
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
