import { defineProject } from 'vitest/config'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

export default defineProject({
  test: {
    name: 'cfo',
    environment: 'node',
    include: ['lib/**/*.test.ts', 'tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      // Stub next-auth + platform-auth server in unit tests
      'next-auth': resolve(__dirname, './__mocks__/next-auth.ts'),
      '@nzila/platform-auth/entra/server': resolve(__dirname, './__mocks__/platform-auth-server.ts'),
      '@nzila/os-core/hash': resolve(ROOT, 'packages/os-core/src/hash.ts'),
      '@nzila/os-core/rateLimit': resolve(ROOT, 'packages/os-core/src/rateLimit.ts'),
      '@nzila/os-core/telemetry': resolve(ROOT, 'packages/os-core/src/telemetry/index.ts'),
      '@nzila/os-core/policy': resolve(ROOT, 'packages/os-core/src/policy/index.ts'),
      '@nzila/os-core/config/super-admins': resolve(ROOT, 'packages/os-core/src/config/super-admins.ts'),
      '@nzila/os-core/config': resolve(ROOT, 'packages/os-core/src/config/env.ts'),
      '@nzila/os-core/retention': resolve(ROOT, 'packages/os-core/src/retention/index.ts'),
      '@nzila/os-core': resolve(ROOT, 'packages/os-core/src/index.ts'),
      '@nzila/commerce-core': resolve(ROOT, 'packages/commerce-core/src/index.ts'),
      '@nzila/commerce-core/types': resolve(ROOT, 'packages/commerce-core/src/types/index.ts'),
      '@nzila/commerce-core/enums': resolve(ROOT, 'packages/commerce-core/src/enums.ts'),
    },
  },
})
