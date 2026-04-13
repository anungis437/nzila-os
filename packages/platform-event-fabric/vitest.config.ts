import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-event-fabric',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
