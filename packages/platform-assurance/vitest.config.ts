import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-assurance',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
