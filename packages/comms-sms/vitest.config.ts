import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    // Dynamic-import barrel/route tests can exceed the 5s vitest default under
    // monorepo-scale parallel runners on Windows; 30s provides comfortable headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    name: 'comms-sms',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
