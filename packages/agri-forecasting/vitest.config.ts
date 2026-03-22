import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'agri-forecasting',
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
})
