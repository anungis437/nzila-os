import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'trustcore-core',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
