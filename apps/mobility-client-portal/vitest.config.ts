import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    // Dynamic-import barrel/route tests can exceed the 5s vitest default under
    // monorepo-scale parallel runners on Windows; 30s provides comfortable headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Trivial route tests were hitting Vitest forks-pool "worker start" timeouts under
    // heavy monorepo parallelism on Windows; threads pool reuses workers and retries
    // absorb the very rare startup blip.
    pool: 'threads',
    retry: 2,
    name: 'mobility-client-portal',
    environment: 'jsdom',
  },
})
