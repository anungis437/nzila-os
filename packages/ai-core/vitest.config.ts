import { defineProject } from 'vitest/config'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

export default defineProject({
  test: {
    // Dynamic-import barrel/route tests can exceed the 5s vitest default under
    // monorepo-scale parallel runners on Windows; 30s provides comfortable headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    name: 'ai-core',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // Resolve workspace subpath exports to their TypeScript source files.
      '@nzila/os-core/hash': resolve(ROOT, 'packages/os-core/src/hash.ts'),
      '@nzila/os-core/telemetry': resolve(ROOT, 'packages/os-core/src/telemetry/index.ts'),
      '@nzila/os-core/policy': resolve(ROOT, 'packages/os-core/src/policy/index.ts'),
      '@nzila/os-core/evidence': resolve(ROOT, 'packages/os-core/src/evidence/index.ts'),
      '@nzila/os-core/config': resolve(ROOT, 'packages/os-core/src/config/env.ts'),
      '@nzila/os-core/ai-env': resolve(ROOT, 'packages/os-core/src/ai-env.ts'),
      '@nzila/os-core': resolve(ROOT, 'packages/os-core/src/index.ts'),
    },
  },
})
