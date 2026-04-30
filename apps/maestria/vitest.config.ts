import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@nzila/maestria',
    environment: 'jsdom',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
  },
})