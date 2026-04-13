import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'db',
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
  },
})
