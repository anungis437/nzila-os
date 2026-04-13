import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-change-management',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
