import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'runtime-attestation',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
