import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'mobility-compliance',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
