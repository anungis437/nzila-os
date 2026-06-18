import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['app/**/*.test.ts', 'lib/**/*.test.ts'],
    passWithNoTests: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      all: false,
      include: ['app/api/mandates/[mandateId]/transition/route.ts'],
      exclude: ['**/*.test.ts', '**/__tests__/**', '**/__mocks__/**'],
      // Strict coverage on the mission-critical mandate transition gate.
      thresholds: {
        lines: 99,
        functions: 99,
        branches: 99,
        statements: 99,
      },
    },
  },
})
