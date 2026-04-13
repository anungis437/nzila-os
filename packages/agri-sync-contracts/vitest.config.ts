import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'agri-sync-contracts',
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
})
