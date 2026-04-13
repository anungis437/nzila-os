import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'os-core',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
