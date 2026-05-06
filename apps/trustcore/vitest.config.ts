import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

export default defineConfig({
  test: {
    include: ['**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@nzila/db/queries/trustcore': resolve(ROOT, 'packages/db/src/queries/trustcore.ts'),
      '@nzila/platform-semantic-search': resolve(ROOT, 'packages/platform-semantic-search/src/index.ts'),
      '@nzila/platform-rum': resolve(ROOT, 'packages/platform-rum/src/index.ts'),
      '@nzila/consent-engine': resolve(ROOT, 'packages/consent-engine/src/index.ts'),
      '@nzila/otel-core': resolve(ROOT, 'packages/otel-core/src/index.ts'),
      '@nzila/platform-billing': resolve(ROOT, 'packages/platform-billing/src/index.ts'),
      '@nzila/platform-event-fabric': resolve(ROOT, 'packages/platform-event-fabric/src/index.ts'),
      '@nzila/platform-auth/entra/server': resolve(__dirname, './__mocks__/platform-auth-server.ts'),
    },
  },
})
