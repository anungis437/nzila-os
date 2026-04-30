import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      'server-only': path.resolve(__dirname, 'test/server-only-shim.ts'),
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    name: 'nzila-hq',
    environment: 'node',
    include: ['lib/**/*.test.ts', 'server/**/*.test.ts'],
    passWithNoTests: true,
  },
})
