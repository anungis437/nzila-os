import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-data-fabric',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
