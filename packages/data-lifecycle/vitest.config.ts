import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'data-lifecycle',
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
})
