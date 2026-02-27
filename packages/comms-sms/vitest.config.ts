import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'comms-sms',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
