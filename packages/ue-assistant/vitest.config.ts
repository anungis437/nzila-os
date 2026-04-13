import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'ue-assistant',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
