import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'comms-email',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
