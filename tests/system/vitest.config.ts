import { defineProject } from 'vitest/config'
import { join } from 'node:path'

const appSrc = (app: string, ...parts: string[]) =>
  join(__dirname, '..', '..', 'apps', app, ...parts)

export default defineProject({
  test: {
    name: 'system-boundary-tests',
    environment: 'node',
    globals: false,
    testTimeout: 10_000,
    include: ['**/*.test.ts'],
  },
  resolve: {
    alias: {
      // Allow importing capability-ownership from control-plane directly
      '@/lib/capability-ownership': appSrc(
        'control-plane',
        'lib',
        'capability-ownership.ts',
      ),
    },
  },
})
