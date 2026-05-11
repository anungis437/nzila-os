import { defineProject } from 'vitest/config'
export default defineProject({
  test: { name: 'governance-review', environment: 'node', include: ['src/**/*.test.ts'] },
})
