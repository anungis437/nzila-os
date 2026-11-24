import assert from 'node:assert/strict'
import { mkdirSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { AUTHORITY_NATIVE_SUITES } from './authority-native-suites.mjs'

// The same per-file native cohort runs locally and in CI. It remains separate
// from the canonical runtime matrix and never counts skipped tests as passes.
assert.equal(AUTHORITY_NATIVE_SUITES.length, 25)
assert.equal(new Set(AUTHORITY_NATIVE_SUITES).size, 25)
if (process.argv.includes('--list')) {
  process.stdout.write(JSON.stringify(AUTHORITY_NATIVE_SUITES) + '\n')
  process.exit(0)
}
const app = fileURLToPath(new URL('../../', import.meta.url))
const root = path.resolve(app, '../..')
const outputArg = process.argv.indexOf('--output')
assert(outputArg > 0 && process.argv[outputArg + 1], 'An explicit --output directory is required')
const output = path.resolve(root, process.argv[outputArg + 1])
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
const sourceSha = git('rev-parse', 'HEAD')
const workingTreeDirty = git('status', '--porcelain') !== ''
const sourceSnapshot = () => {
  const files = git('ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean).sort()
  const untracked = files.map(file => [file, createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')])
  return createHash('sha256').update(JSON.stringify([git('rev-parse', 'HEAD'), git('status', '--porcelain'), git('diff', '--binary', 'HEAD'), untracked])).digest('hex')
}
const sourceSnapshotSha256 = sourceSnapshot()
const ownedContainers = () => execFileSync('docker', ['ps', '-aq', '--filter', 'label=nzila.qualification-owner'], { encoding: 'utf8' }).trim().split(/\s+/).filter(Boolean)
const originalOwnedContainers = new Set(ownedContainers())
const names = AUTHORITY_NATIVE_SUITES.map(suite => `kernel-native-${path.basename(suite, '.pglite.test.ts')}.json`)
assert.equal(new Set(names).size, 25, 'Native result filenames must be unique')
if (existsSync(output))
  assert.equal(readdirSync(output).filter(name => name.startsWith('kernel-native-')).length, 0, 'Preserve earlier native evidence')
for (const file of [...names, 'authority-native-summary.json'])
  assert(!existsSync(path.join(output, file)), 'Preserve earlier native evidence: ' + file)
mkdirSync(output, { recursive: true })
const env = { ...process.env, UE_AUTHORITY_KERNEL_NATIVE: '1', UE_AUTHORITY_GUARDS_NATIVE: '1', UE_CASE_DOMAIN_NATIVE: '1' }
const connectionVariables = ['DATABASE_URL', 'SYSTEM_DATABASE_URL', 'AUTH_DATABASE_URL', 'AUTH_SYSTEM_DATABASE_URL', 'UE_NATIVE_TEMPLATE_URL', 'UE_AUTHORITY_COMBINED_URL', 'UE_CENSUS_URL', 'UE_NATIVE_OPERATOR_URL', 'UE_NATIVE_RUNTIME_URL', 'UE_NATIVE_SYSTEM_URL']
const removedConnectionVariables = Object.keys(env).filter(name => connectionVariables.includes(name) || name.startsWith('PG'))
for (const name of removedConnectionVariables) delete env[name]
const summary = { sourceSha, workingTreeDirty, sourceSnapshotSha256, removedConnectionVariables, status: 'IN_PROGRESS', files: 0, passed: 0, failed: 0, skipped: 0, suites: [], stagingAcceptance: false }
const save = () => writeFileSync(path.join(output, 'authority-native-summary.json'), JSON.stringify(summary, null, 2) + '\n')
save()
for (const [index, suite] of AUTHORITY_NATIVE_SUITES.entries()) {
  assert(existsSync(path.join(app, suite)), 'Declared native suite missing: ' + suite)
  assert.equal(git('rev-parse', 'HEAD'), sourceSha, 'Candidate moved during native qualification')
  assert.equal(sourceSnapshot(), sourceSnapshotSha256, 'Source bytes changed during native qualification')
  const file = path.join(output, names[index])
  const result = spawnSync('pnpm', ['exec', 'vitest', 'run', suite, '--maxWorkers=1', '--reporter=default', '--reporter=json', '--outputFile=' + file],
    { cwd: app, env, stdio: 'inherit', timeout: 300_000, killSignal: 'SIGTERM' })
  if (result.error || result.signal || result.status !== 0) {
    summary.status = 'FAILED'; save()
    if (result.error) throw result.error
    throw new Error(`Native authority suite failed or interrupted: ${suite}; exit=${result.status}; signal=${result.signal}`)
  }
  const observed = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(sourceSnapshot(), sourceSnapshotSha256, 'Source bytes changed during native qualification')
  const validResult = observed.success === true && observed.numTotalTests > 0 && observed.numPassedTests === observed.numTotalTests
    && observed.numFailedTests === 0 && observed.numPendingTests === 0 && (observed.numTodoTests ?? 0) === 0
  if (!validResult) { summary.status = 'FAILED'; save() }
  assert(validResult, 'Every declared native assertion must pass without skips: ' + suite)
  summary.files++; summary.passed += observed.numPassedTests
  summary.suites.push({ suite, resultFile: file, passed: observed.numPassedTests, failed: 0, skipped: 0 })
  save()
}
assert.equal(summary.files, 25)
assert.deepEqual(readdirSync(output).filter(name => name.startsWith('kernel-native-')).sort(), [...names].sort())
assert.equal(sourceSnapshot(), sourceSnapshotSha256, 'Source bytes changed during native qualification')
summary.newOwnedContainersRemaining = ownedContainers().filter(id => !originalOwnedContainers.has(id))
assert.equal(summary.newOwnedContainersRemaining.length, 0, 'Owned native fixture cleanup was not verified')
summary.status = workingTreeDirty ? 'PASS_WORKING_TREE_NATIVE_AUTHORITY_ONLY' : 'PASS_EXACT_SOURCE_NATIVE_AUTHORITY'
save()
process.stdout.write(JSON.stringify({ ...summary, suites: undefined }) + '\n')
