import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'clinical-timeline',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
