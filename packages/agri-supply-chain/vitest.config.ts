import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'agri-supply-chain',
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
})
