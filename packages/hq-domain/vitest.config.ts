import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'hq-domain',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
