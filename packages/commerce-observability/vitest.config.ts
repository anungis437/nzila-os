import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'commerce-observability',
    include: ['src/**/*.test.ts'],
  },
})
