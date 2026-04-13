import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-governance',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
