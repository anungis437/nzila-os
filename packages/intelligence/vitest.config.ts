import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'intelligence',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
