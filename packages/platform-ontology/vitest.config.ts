import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'platform-ontology',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
