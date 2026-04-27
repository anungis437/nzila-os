import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'consent-engine',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
