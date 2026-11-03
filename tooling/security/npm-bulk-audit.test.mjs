import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseLockfilePackages, normalizeAdvisoryResponse } from './npm-bulk-audit.mjs'

function withLockfile(contents, run) {
  const folder = mkdtempSync(join(tmpdir(), 'nzila-audit-'))
  try {
    const filename = join(folder, 'pnpm-lock.yaml')
    writeFileSync(filename, contents)
    return run(filename)
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
}

test('a malformed or empty lockfile cannot be certified as no dependencies', () => {
  withLockfile('lockfileVersion: 9.0\n', (file) =>
    assert.throws(() => parseLockfilePackages(file), /Missing snapshots\/packages/))
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n', (file) =>
    assert.throws(() => parseLockfilePackages(file), /No resolved packages/))
})

test('resolved direct, scoped, and peer-suffixed packages are inventoried', () => {
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n    dependencies: {}\n  @scope/pkg@1.2.3(peer@2.0.0):\n    dependencies: {}\n', (file) => {
    const result = parseLockfilePackages(file)
    assert.deepEqual([...result.get('undici')], ['7.29.1'])
    assert.deepEqual([...result.get('@scope/pkg')], ['1.2.3'])
  })
})

test('registry response is strictly typed and bound to installed packages', () => {
  const packages = new Map([['node-forge', new Set(['1.4.0'])]])
  assert.deepEqual(normalizeAdvisoryResponse({}, packages), {})
  assert.throws(() => normalizeAdvisoryResponse([], packages), /expected package-to-advisory/)
  assert.throws(() => normalizeAdvisoryResponse({ unknown: [] }, packages), /Invalid audit package/)
  assert.throws(() => normalizeAdvisoryResponse({ 'node-forge': {} }, packages), /Invalid audit package/)
  assert.throws(() => normalizeAdvisoryResponse({ 'node-forge': [{ id: 'bad', severity: 'high', title: 'x' }] }, packages), /Invalid advisory record/)
  assert.throws(() => normalizeAdvisoryResponse({ 'node-forge': [{ id: 123, severity: 'unknown', title: 'x' }] }, packages), /Invalid advisory record/)
  assert.deepEqual(
    normalizeAdvisoryResponse({ 'node-forge': [{ id: 1244017, severity: 'high', title: 'PEM DoS' }] }, packages),
    { '1244017': { id: 1244017, severity: 'high', title: 'PEM DoS', package: 'node-forge' } },
  )
})

test('unsupported ignore-registry-errors escape hatch is rejected before any scan', () => {
  const file = fileURLToPath(new URL('./npm-bulk-audit.mjs', import.meta.url))
  const result = spawnSync(process.execPath, [resolve(file), '--ignore-registry-errors'], {
    encoding: 'utf8',
    timeout: 5000,
  })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /Registry or audit failures cannot be ignored/)
})
