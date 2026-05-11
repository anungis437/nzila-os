import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.{test,spec}.ts', '**/*.{test,spec}.tsx'],
    exclude: ['node_modules', '.next', '.turbo', 'dist'],
    passWithNoTests: true,
  },
})
