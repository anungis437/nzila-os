import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'qbo',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
