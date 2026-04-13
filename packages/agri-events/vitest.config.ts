import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'agri-events',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
