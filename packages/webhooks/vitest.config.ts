import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'webhooks',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
