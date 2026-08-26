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
    // Dynamic-import barrel/route tests can exceed the 5s vitest default under
    // monorepo-scale parallel runners on Windows; 30s provides comfortable headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    name: 'nzila-hq',
    environment: 'node',
    include: ['lib/**/*.test.ts', 'server/**/*.test.ts'],
    passWithNoTests: true,
  },
})
