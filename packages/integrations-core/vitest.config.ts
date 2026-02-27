import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'integrations-core',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
