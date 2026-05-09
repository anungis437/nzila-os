import { defineProject } from 'vitest/config'
export default defineProject({
  test: { name: 'attestation-visibility', environment: 'node', include: ['src/**/*.test.ts'] },
})
