import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'agri-reporting',
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
})
