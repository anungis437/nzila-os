import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

// Exercise every native route-harness caller, including its partial mocks,
// before the larger repository run. The native setup owns a separate clone for
// each file; a missing fixture must fail instead of turning this into skips.
const app = fileURLToPath(new URL('../../', import.meta.url))
const template = process.env.UE_NATIVE_TEMPLATE_URL
if (!template || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(template).hostname)) {
  throw new Error('An explicitly provisioned loopback UE_NATIVE_TEMPLATE_URL is required')
}
const directory = path.join(app, 'db/__tests__')
const files = readdirSync(directory)
  .filter(name => /\.(?:postgres|native)\.test\.ts$/.test(name))
  .filter(name => readFileSync(path.join(directory, name), 'utf8').includes('native-route-harness'))
  .sort()
  .map(name => `db/__tests__/${name}`)
if (!files.length) throw new Error('No native route-harness callers found')
console.log(`Native route-context preflight: ${files.length} caller files`)
const result = spawnSync('pnpm', [
  'exec', 'vitest', 'run', '--config', 'vitest.native.config.ts', '--maxWorkers=1',
  ...files, ...process.argv.slice(2),
], { cwd: app, env: process.env, stdio: 'inherit' })
if (result.error) throw result.error
if (result.signal) throw new Error(`Native route-context preflight interrupted: ${result.signal}`)
process.exitCode = result.status ?? 1
