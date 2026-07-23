import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'db',
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    // Runtime tests dynamically import postgres/drizzle modules with mocks;
    // cold module resolution on Windows + monorepo-scale parallel runners can
    // exceed the vitest defaults. 30s gives comfortable headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
