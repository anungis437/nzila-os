import { defineProject } from 'vitest/config'
import { join } from 'node:path'

export default defineProject({
  test: {
    name: 'contract-tests',
    environment: 'node',
    globals: false,
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**'],
  },
  resolve: {
    alias: {
      // Allow contract tests to import from the monorepo root
      '@repo-root': join(__dirname, '..', '..'),
    },
  },
})
