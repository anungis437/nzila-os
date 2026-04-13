import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-deploy',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
