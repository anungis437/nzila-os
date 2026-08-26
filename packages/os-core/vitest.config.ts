import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'os-core',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Barrel-export and evidence-index tests dynamically import large module
    // trees; cold module resolution on Windows + monorepo-scale parallel
    // runners can exceed the vitest defaults. 30s gives comfortable headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
