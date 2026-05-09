import { defineProject } from 'vitest/config'
export default defineProject({
  test: { name: 'continuity-review', environment: 'node', include: ['src/**/*.test.ts'] },
})
