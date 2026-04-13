import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    passWithNoTests: true,
    name: 'comms-email',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
