import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'tools-runtime',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
