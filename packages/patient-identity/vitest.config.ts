import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'patient-identity',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
