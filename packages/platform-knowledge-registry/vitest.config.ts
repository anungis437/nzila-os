import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-knowledge-registry',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
