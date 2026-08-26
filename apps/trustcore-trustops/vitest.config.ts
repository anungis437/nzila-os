import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Dynamic-import barrel/route tests can exceed the 5s vitest default under
    // monorepo-scale parallel runners on Windows; 30s provides comfortable headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['app/**/*.test.ts', 'lib/**/*.test.ts'],
    passWithNoTests: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
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
