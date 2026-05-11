import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'governance-runtime',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
