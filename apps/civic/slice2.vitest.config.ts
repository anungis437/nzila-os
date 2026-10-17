import { defineConfig } from 'vitest/config'
import baseline from './vitest.config'

export default defineConfig({
  resolve: baseline.resolve,
  test: {
    name: 'civic-synthetic-slice2-hardening',
    environment: 'node',
    include: ['tests/slice2/**/*.test.ts'],
    testTimeout: 2_400_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
})
