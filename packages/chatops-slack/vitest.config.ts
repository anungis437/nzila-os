import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'chatops-slack',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
