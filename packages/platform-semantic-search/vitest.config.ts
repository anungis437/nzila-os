import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-semantic-search',
    include: ['src/**/*.test.ts'],
  },
})
