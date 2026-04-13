import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'db',
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
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
