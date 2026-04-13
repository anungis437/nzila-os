import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@nzila/commerce-governance',
    include: ['src/**/*.test.ts'],
  },
})
