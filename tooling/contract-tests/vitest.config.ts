import { defineConfig } from 'vitest/config'
import { join } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tooling/contract-tests/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
  },
  resolve: {
    alias: {
      // Allow contract tests to import from the monorepo root
      '@repo-root': join(__dirname, '..', '..'),
    },
  },
})
