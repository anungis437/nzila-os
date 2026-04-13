import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-admin',
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
