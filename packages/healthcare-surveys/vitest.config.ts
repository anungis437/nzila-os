import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'healthcare-surveys',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
