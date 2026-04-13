import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'integrations-m365',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
