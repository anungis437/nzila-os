import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'agrimo-core',
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
})
