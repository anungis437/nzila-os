import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'integrations-pension',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
