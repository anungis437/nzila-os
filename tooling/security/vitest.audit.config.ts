import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tooling/security/supply-chain-policy.test.ts'],
    maxWorkers: 1,
  },
})
