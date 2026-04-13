import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'cora',
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
