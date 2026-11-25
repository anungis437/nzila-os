import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// Keep the authority census and its dependent trace together. Validation only
// compares committed evidence; generation remains an explicit source change.
const app = fileURLToPath(new URL('../../', import.meta.url))
const root = path.resolve(app, '../..')
const env = { ...process.env, TSX_TSCONFIG_PATH: path.join(app, 'tsconfig.json') }

for (const script of ['transitive-authority-census.ts', 'step1-evidence-trace.ts']) {
  const result = spawnSync('pnpm', [
    'exec', 'tsx', path.join(app, 'scripts/reality', script), '--check',
  ], { cwd: root, env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.signal) throw new Error(`Generated evidence preflight interrupted: ${result.signal}`)
  if (result.status !== 0) process.exit(result.status ?? 1)
}
