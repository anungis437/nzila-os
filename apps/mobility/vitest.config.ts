import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'mobility',
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
})
