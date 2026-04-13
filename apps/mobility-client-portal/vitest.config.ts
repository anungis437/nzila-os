import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'mobility-client-portal',
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'lib/**/*.tsx'],
      exclude: ['lib/**/*.test.ts', 'lib/**/*.test.tsx', 'lib/**/__tests__/**', 'lib/**/__mocks__/**'],
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
})
