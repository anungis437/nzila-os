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
    // Deterministic ordering: run tests sequentially with stable sort
    sequence: {
      shuffle: false,
    },
    // Expose seed via env for deterministic helpers
    env: {
      REDTEAM_SEED: process.env.REDTEAM_SEED ?? '42',
    },
  },
  resolve: {
    alias: {
      '@repo-root': resolve(__dirname, '..', '..'),
    },
  },
})
