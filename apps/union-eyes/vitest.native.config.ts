/**
 * Dedicated native PostgreSQL project.
 * The fast unit project intentionally excludes *.postgres.test.ts; these must
 * instead run against an explicitly provisioned disposable combined database.
 * Never substitute PGlite for the native RLS role/grant tests here.
 *
 * With UE_NATIVE_TEMPLATE_URL set, every file runs in its own clone of that database (see scripts/runtime/native-test-database-isolation.ts).
 */
import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { sharedResolve, sharedSetupFiles } from './vitest.shared'

export default defineConfig({
  plugins: [react()],
  resolve: sharedResolve,
  test: {
    name: 'union-eyes-native',
    setupFiles: [...sharedSetupFiles, path.resolve(__dirname, 'scripts/runtime/native-test-database-isolation.ts')],
    include: ['db/__tests__/*.postgres.test.ts', 'db/__tests__/*.native.test.ts'],
    exclude: ['**/node_modules/**', '**/.git/**', '**/.next/**'],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
})
