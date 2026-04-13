import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'integrations-hubspot',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
