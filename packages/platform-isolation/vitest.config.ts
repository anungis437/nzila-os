import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-isolation',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
