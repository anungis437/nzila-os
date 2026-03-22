import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'agrimo-intelligence',
    include: ['__tests__/**/*.test.ts'],
  },
})
