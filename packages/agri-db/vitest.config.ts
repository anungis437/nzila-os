import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'agri-db',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
