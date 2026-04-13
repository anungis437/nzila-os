import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'mobility-ai',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
