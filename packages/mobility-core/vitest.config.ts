import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'mobility-core',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
