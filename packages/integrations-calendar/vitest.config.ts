import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'integrations-calendar',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
