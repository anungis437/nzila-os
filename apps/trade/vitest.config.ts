import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'trade',
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
