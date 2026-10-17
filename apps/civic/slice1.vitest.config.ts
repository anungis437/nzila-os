import { defineConfig } from 'vitest/config'
import slice0 from './vitest.config'

export default defineConfig({
  resolve: slice0.resolve,
  test: {
    name: 'civic-local-durable-slice1',
    environment: 'node',
    include: ['tests/slice1/**/*.test.ts'],
    testTimeout: 600_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
})
