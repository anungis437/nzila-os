import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-feature-flags',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
