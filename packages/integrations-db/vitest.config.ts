import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'integrations-db',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
