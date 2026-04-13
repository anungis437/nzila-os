import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-environment',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
