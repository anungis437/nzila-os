import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'crm-hubspot',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
