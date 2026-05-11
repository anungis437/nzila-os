import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'trustcore-contracts',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
