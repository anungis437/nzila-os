import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-rfp-generator',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
