import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'web',
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
