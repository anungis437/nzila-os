import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Dynamic-import barrel/route tests can exceed the 5s vitest default under
    // monorepo-scale parallel runners on Windows; 30s provides comfortable headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    name: 'agrimo-intelligence',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/__tests__/**', 'src/**/__mocks__/**'],
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
})
