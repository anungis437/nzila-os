import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    // Dynamic-import barrel/route tests can exceed the 5s vitest default under
    // monorepo-scale parallel runners on Windows; 30s provides comfortable headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    name: "nacp-exams",
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
    ],
    coverage: {
      provider: 'v8',
      include: [
        'lib/resolve-org.ts',
        'lib/api-guards.ts',
        'app/api/health/route.ts',
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
