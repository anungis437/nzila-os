import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseLockfilePackages, normalizeAdvisoryResponse, fetchAdvisories } from './npm-bulk-audit.mjs'

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
    { '1244017': { id: '1244017', severity: 'high', title: 'PEM DoS', package: 'node-forge' } },
  )
})

test('noncanonical advisory IDs cannot alias valid advisory identities', () => {
  const packages = new Map([['node-forge', new Set(['1.4.0'])]])
  for (const id of ['001244017', ' 1244017', '1e3', '+1244017', '0', 0, -1, 1.5, null]) {
    assert.throws(
      () => normalizeAdvisoryResponse({ 'node-forge': [{ id, severity: 'high', title: 'Forged ID' }] }, packages),
      /Invalid advisory record/,
      String(id),
    )
  }
  assert.deepEqual(
    normalizeAdvisoryResponse({ 'node-forge': [{ id: '1244017', severity: 'high', title: 'Valid ID' }] }, packages),
    { '1244017': { id: '1244017', severity: 'high', title: 'Valid ID', package: 'node-forge' } },
  )
})

test('duplicate advisory IDs cannot overwrite or downgrade earlier findings', () => {
  const packages = new Map([
    ['node-forge', new Set(['1.4.0'])],
    ['follow-redirects', new Set(['1.16.1'])],
  ])
  const high = { id: 1244017, severity: 'high', title: 'PEM DoS' }
  const low = { id: 1244017, severity: 'low', title: 'Forged downgrade' }
  assert.throws(
    () => normalizeAdvisoryResponse({ 'node-forge': [high, low] }, packages),
    /Duplicate advisory ID/,
  )
  assert.throws(
    () => normalizeAdvisoryResponse({ 'node-forge': [high], 'follow-redirects': [low] }, packages),
    /Duplicate advisory ID/,
  )
  assert.deepEqual(
    normalizeAdvisoryResponse({ 'node-forge': [high] }, packages),
    { '1244017': { ...high, id: '1244017', package: 'node-forge' } },
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

test('inventory rejects fabricated keys, unsupported lockfiles, and out-of-section records', () => {
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\npackages:\n  forged@1.0.0:\n', (file) => {
    const inventory = parseLockfilePackages(file)
    assert.deepEqual([...inventory.keys()], ['undici'])
  })
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@not-a-version:\n', (file) =>
    assert.throws(() => parseLockfilePackages(file), /Malformed resolved snapshot key/))
  withLockfile('lockfileVersion: 6.0\nsnapshots:\n  undici@7.29.1:\n', (file) =>
    assert.throws(() => parseLockfilePackages(file), /Unsupported pnpm lockfile version/))
})


test('duplicate snapshots sections cannot hide dependencies from the audit inventory', () => {
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\npackages:\n  undici@7.29.1:\nsnapshots:\n  node-forge@1.4.0:\n', (file) =>
    assert.throws(() => parseLockfilePackages(file), /Ambiguous pnpm lockfile/))
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n', (file) =>
    assert.deepEqual([...parseLockfilePackages(file).keys()], ['undici']))
})


test('duplicate or conflicting lockfile version declarations fail closed', () => {
  for (const prefix of [
    'lockfileVersion: 9.0\nlockfileVersion: 6.0\n',
    'lockfileVersion: 6.0\nlockfileVersion: 9.0\n',
    'lockfileVersion: 9.0\nlockfileVersion: 9.0\n',
  ]) {
    withLockfile(prefix + 'snapshots:\n  undici@7.29.1:\n', (file) =>
      assert.throws(() => parseLockfilePackages(file), /Unsupported pnpm lockfile version or ambiguous declarations/))
  }
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n', (file) =>
    assert.deepEqual([...parseLockfilePackages(file).keys()], ['undici']))
})

test('duplicate resolved snapshot keys fail closed instead of silently collapsing the graph', () => {
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n    dependencies: {}\n  undici@7.29.1:\n    dependencies:\n      injected: 1.0.0\n', (file) =>
    assert.throws(() => parseLockfilePackages(file), /Duplicate resolved snapshot key/))
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n  undici@7.29.2:\n', (file) =>
    assert.deepEqual([...parseLockfilePackages(file).get('undici')], ['7.29.1', '7.29.2']))
})


test('ambiguous audit CLI flags fail before reading a lockfile or contacting the registry', () => {
  const file = fileURLToPath(new URL('./npm-bulk-audit.mjs', import.meta.url))
  for (const flags of [
    ['--audit-level=high', '--audit-level=critical'],
    ['--audit-level=critical', '--audit-level=high'],
    ['--output=report.json', '--output=other.json'],
    ['--output='],
    ['--json', '--json'],
    ['--json', '--output=report.json'],
    ['--output=report.json', '--json'],
  ]) {
    const result = spawnSync(process.execPath, [resolve(file), ...flags], {
      encoding: 'utf8', timeout: 5000,
    })
    assert.equal(result.status, 2, flags.join(' '))
    assert.match(result.stderr, /Ambiguous or empty audit options/)
  }
})

test('audit report paths containing equals signs are preserved without truncation', () => {
  const folder = mkdtempSync(join(tmpdir(), 'nzila-audit-output-'))
  try {
    writeFileSync(join(folder, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n')
    const mock = join(folder, 'mock-registry.mjs')
    writeFileSync(mock, "globalThis.fetch = async () => ({ ok: true, json: async () => ({}) })\n")
    const reportName = 'audit=security=report.json'
    const script = fileURLToPath(new URL('./npm-bulk-audit.mjs', import.meta.url))
    const result = spawnSync(process.execPath, ['--import', mock, script, '--audit-level=high', '--output=' + reportName], {
      cwd: folder, encoding: 'utf8', timeout: 5000,
    })
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(readFileSync(join(folder, reportName), 'utf8'))
    assert.equal(report.metadata.status, 'complete')
    assert.equal(report.metadata.source, 'npm-bulk-advisories')
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})


test('noncanonical snapshot headers cannot conceal a second dependency graph', () => {
  for (const header of ['snapshots: ', 'snapshots :', 'snapshots:\t']) {
    withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n' + header + '\n  node-forge@1.4.0:\n', (file) =>
      assert.throws(() => parseLockfilePackages(file), /Malformed snapshots section header/))
  }
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n', (file) =>
    assert.deepEqual([...parseLockfilePackages(file).keys()], ['undici']))
})

test('the shapes pnpm actually writes are inventoried: quoted keys and empty inline mappings', () => {
  const lock = [
    'lockfileVersion: 9.0',
    'snapshots:',
    "  '@adobe/css-tools@4.4.4': {}",
    "  '@scope/pkg@1.2.3(react@18.3.1)':",
    '    dependencies:',
    '      react: 18.3.1',
    '  js-tokens@4.0.0: {}',
    '  react@18.3.1:',
    '    dependencies:',
    '      js-tokens: 4.0.0',
    '',
  ].join('\n')
  withLockfile(lock, (file) => {
    const result = parseLockfilePackages(file)
    assert.deepEqual([...result.get('@adobe/css-tools')], ['4.4.4'])
    assert.deepEqual([...result.get('@scope/pkg')], ['1.2.3'])
    assert.deepEqual([...result.get('js-tokens')], ['4.0.0'])
    assert.deepEqual([...result.get('react')], ['18.3.1'])
  })
  // A quoted and a bare spelling of one key are the same YAML key: still a duplicate.
  withLockfile("lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1: {}\n  'undici@7.29.1': {}\n", (file) =>
    assert.throws(() => parseLockfilePackages(file), /Duplicate resolved snapshot key/))
  // Only an empty inline mapping is accepted; any other inline value or a dangling quote is malformed.
  for (const bad of ["  undici@7.29.1: {a: 1}", "  'undici@7.29.1: {}", '  "undici@7.29.1": {}', '  undici@7.29.1: []']) {
    withLockfile('lockfileVersion: 9.0\nsnapshots:\n' + bad + '\n', (file) =>
      assert.throws(() => parseLockfilePackages(file), /Malformed resolved snapshot key/, bad))
  }
})

test("the repository's own pnpm-lock.yaml parses completely", () => {
  const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
  const lock = join(root, 'pnpm-lock.yaml')
  const inventory = parseLockfilePackages(lock)
  const entries = readFileSync(lock, 'utf-8').split(/\r?\n/)
  const start = entries.indexOf('snapshots:')
  const keys = entries.slice(start + 1).filter((line) => /^ {2}\S/.test(line)).length
  let versions = 0
  for (const set of inventory.values()) versions += set.size
  assert.ok(keys > 1000, `expected a real lockfile, saw ${keys} snapshot keys`)
  assert.ok(versions > 1000 && versions <= keys, `${versions} versions from ${keys} keys`)
})

test('advisory ids are recorded as the canonical string the policy binds to the map key', () => {
  const pkgMap = new Map([['esbuild', new Set(['0.27.3'])]])
  const flat = normalizeAdvisoryResponse(
    { esbuild: [{ id: 1120680, severity: 'low', title: 'esbuild dev server file read', vulnerable_versions: '>=0.27.3 <0.28.1' }] },
    pkgMap,
  )
  assert.deepEqual(Object.keys(flat), ['1120680'])
  assert.equal(flat['1120680'].id, '1120680')
  assert.equal(flat['1120680'].package, 'esbuild')
})


test('audit registry redirects are rejected without forwarding the dependency inventory', async () => {
  const previousFetch = globalThis.fetch
  const pkgMap = new Map([['node-forge', new Set(['1.4.0'])]])
  let requests = 0
  try {
    globalThis.fetch = async (_url, options) => {
      requests++
      assert.equal(options.method, 'POST')
      assert.equal(options.redirect, 'manual')
      assert.deepEqual(JSON.parse(options.body), { 'node-forge': ['1.4.0'] })
      return { ok: false, status: 302, headers: new Headers({ location: 'https://untrusted.example/collect' }) }
    }
    await assert.rejects(fetchAdvisories(pkgMap), /Audit registry returned HTTP 302/)
    assert.equal(requests, 1)
  } finally {
    globalThis.fetch = previousFetch
  }
})
