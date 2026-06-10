import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'mobility',
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      all: false,
      include: [
        'proxy.ts',
        'app/api/health/route.ts',
        'app/api/ready/route.ts',
        'app/api/version/route.ts',
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
} as unknown as Parameters<typeof defineProject>[0])
