import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    root: resolve(__dirname),
    include: ['**/*.test.ts'],
    globals: false,
    passWithNoTests: false,
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './redteam-results.json',
    },
  },
  resolve: {
    alias: {
      '@repo-root': resolve(__dirname, '..', '..'),
    },
  },
})
