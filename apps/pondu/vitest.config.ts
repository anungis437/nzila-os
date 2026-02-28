import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'pondu',
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
