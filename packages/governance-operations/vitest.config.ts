import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'governance-operations',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
