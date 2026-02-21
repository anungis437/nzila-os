import { defineProject } from 'vitest/config'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

export default defineProject({
  test: {
    name: 'console',
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // Resolve workspace subpath exports to their TypeScript source files.
      // Required because pnpm + vitest cannot follow package.json `exports`
      // pointing to .ts files without these aliases.
      '@nzila/os-core/hash': resolve(ROOT, 'packages/os-core/src/hash.ts'),
      '@nzila/os-core/rateLimit': resolve(ROOT, 'packages/os-core/src/rateLimit.ts'),
      '@nzila/os-core/telemetry': resolve(ROOT, 'packages/os-core/src/telemetry/index.ts'),
      '@nzila/os-core/policy': resolve(ROOT, 'packages/os-core/src/policy/index.ts'),
      '@nzila/os-core/config': resolve(ROOT, 'packages/os-core/src/config/env.ts'),
      '@nzila/os-core/retention': resolve(ROOT, 'packages/os-core/src/retention/index.ts'),
      '@nzila/os-core': resolve(ROOT, 'packages/os-core/src/index.ts'),
    },
  },
})
