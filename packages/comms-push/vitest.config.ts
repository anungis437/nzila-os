import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'comms-push',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
