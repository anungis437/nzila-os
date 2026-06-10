import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "nacp-exams",
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
    ],
    coverage: {
      provider: 'v8',
      all: false,
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
