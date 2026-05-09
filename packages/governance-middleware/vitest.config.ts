import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'governance-middleware',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
