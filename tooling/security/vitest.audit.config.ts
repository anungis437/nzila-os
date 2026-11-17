import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tooling/security/supply-chain-policy.test.ts', 'tooling/security/sbom.test.ts'],
    maxWorkers: 1,
  },
})
