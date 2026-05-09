import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'assurance-engine',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
