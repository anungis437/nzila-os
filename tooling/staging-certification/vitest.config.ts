/**
 * Staging Certification — Vitest Configuration
 *
 * Separate config for staging-like certification tests.
 * These tests validate the enforcement system holds under staging conditions.
 */
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.cert.ts'],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      '@repo-root': resolve(__dirname, '../..'),
    },
  },
})
