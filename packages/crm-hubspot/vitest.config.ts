import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    passWithNoTests: true,
    name: 'crm-hubspot',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
