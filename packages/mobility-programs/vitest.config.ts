import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'mobility-programs',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
