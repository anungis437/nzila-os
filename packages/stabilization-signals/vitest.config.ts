import { defineProject } from 'vitest/config'
export default defineProject({
  test: { name: 'stabilization-signals', environment: 'node', include: ['src/**/*.test.ts'] },
})
