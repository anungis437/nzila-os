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
  assert.throws(() => normalizeAdvisoryResponse({ 'node-forge': [{ id: 'bad', severity: 'high', title: 'x', vulnerable_versions: '*' }] }, packages), /Invalid advisory record/)
  assert.throws(() => normalizeAdvisoryResponse({ 'node-forge': [{ id: 123, severity: 'unknown', title: 'x', vulnerable_versions: '*' }] }, packages), /Invalid advisory record/)
  assert.deepEqual(
    normalizeAdvisoryResponse({ 'node-forge': [{ id: 1244017, severity: 'high', title: 'PEM DoS', vulnerable_versions: '*' }] }, packages),
    { '1244017': { id: '1244017', severity: 'high', title: 'PEM DoS', vulnerable_versions: '*', package: 'node-forge' } },
  )
})

test('registry advisory package aliases cannot contradict the audited package', () => {
  const packages = new Map([['node-forge', new Set(['1.4.0'])]])
  const advisory = { id: 1244017, severity: 'high', title: 'PEM DoS', vulnerable_versions: '<1.4.1' }
  for (const alias of ['package', 'module_name', 'name']) {
    assert.throws(() => normalizeAdvisoryResponse({ 'node-forge': [{ ...advisory, [alias]: 'unrelated-package' }] }, packages), /Conflicting advisory package identity/)
    assert.throws(() => normalizeAdvisoryResponse({ 'node-forge': [{ ...advisory, [alias]: null }] }, packages), /Conflicting advisory package identity/)
  }
  assert.equal(normalizeAdvisoryResponse({ 'node-forge': [{ ...advisory, package: 'node-forge', module_name: 'node-forge' }] }, packages)['1244017'].package, 'node-forge')
})

test('missing or empty vulnerable version ranges cannot certify advisory coverage', () => {
  const packages = new Map([['node-forge', new Set(['1.4.0'])]])
  for (const range of [undefined, null, '', '   ', 42]) {
    const advisory = { id: 1244017, severity: 'high', title: 'PEM DoS' }
    if (range !== undefined) advisory.vulnerable_versions = range
    assert.throws(() => normalizeAdvisoryResponse({ 'node-forge': [advisory] }, packages), /Invalid advisory record/)
  }
  const valid = { id: 1244017, severity: 'high', title: 'PEM DoS', vulnerable_versions: '<1.4.1' }
  assert.equal(normalizeAdvisoryResponse({ 'node-forge': [valid] }, packages)['1244017'].vulnerable_versions, '<1.4.1')
})

test('noncanonical advisory IDs cannot alias valid advisory identities', () => {
  const packages = new Map([['node-forge', new Set(['1.4.0'])]])
  for (const id of ['001244017', ' 1244017', '1e3', '+1244017', '0', 0, -1, 1.5, null]) {
    assert.throws(
      () => normalizeAdvisoryResponse({ 'node-forge': [{ id, severity: 'high', title: 'Forged ID', vulnerable_versions: '*' }] }, packages),
      /Invalid advisory record/,
      String(id),
    )
  }
  assert.deepEqual(
    normalizeAdvisoryResponse({ 'node-forge': [{ id: '1244017', severity: 'high', title: 'Valid ID', vulnerable_versions: '*' }] }, packages),
    { '1244017': { id: '1244017', severity: 'high', title: 'Valid ID', vulnerable_versions: '*', package: 'node-forge' } },
  )
})

test('duplicate advisory IDs cannot overwrite or downgrade earlier findings', () => {
  const packages = new Map([
    ['node-forge', new Set(['1.4.0'])],
    ['follow-redirects', new Set(['1.16.1'])],
  ])
  const high = { id: 1244017, severity: 'high', title: 'PEM DoS', vulnerable_versions: '*' }
  const low = { id: 1244017, severity: 'low', title: 'Forged downgrade', vulnerable_versions: '*' }
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
    assert.throws(() => parseLockfilePackages(file), /Unexpected top-level section/)
  })
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@not-a-version:\n', (file) =>
    assert.throws(() => parseLockfilePackages(file), /Malformed resolved snapshot key/))
  withLockfile('lockfileVersion: 6.0\nsnapshots:\n  undici@7.29.1:\n', (file) =>
    assert.throws(() => parseLockfilePackages(file), /Unsupported pnpm lockfile version/))
})


test('one-space snapshot entries cannot disappear from the audited graph', () => {
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n node-forge@1.4.0:\n', (file) =>
    assert.throws(() => parseLockfilePackages(file), /Malformed snapshot indentation/))
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n    dependencies:\n      node-forge: 1.4.0\n', (file) =>
    assert.deepEqual([...parseLockfilePackages(file).keys()], ['undici']))
})

test('three-space snapshot keys cannot disappear from the audited dependency graph', () => {
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n   node-forge@1.4.0:\n', (file) =>
    assert.throws(() => parseLockfilePackages(file), /Malformed snapshot indentation/))
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n    dependencies:\n      node-forge: 1.4.0\n', (file) =>
    assert.deepEqual([...parseLockfilePackages(file).keys()], ['undici']))
})

test('five-space malformed snapshot keys cannot disappear from the audited graph', () => {
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n     node-forge@1.4.0:\n', (file) =>
    assert.throws(() => parseLockfilePackages(file), /Malformed snapshot indentation/))
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n    dependencies:\n      node-forge: 1.4.0\n', (file) =>
    assert.deepEqual([...parseLockfilePackages(file).keys()], ['undici']))
})

test('all odd-depth snapshot indentation is rejected, including seven and nine spaces', () => {
  for (const depth of [1, 3, 5, 7, 9]) {
    withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n' +
      ' '.repeat(depth) + 'node-forge@1.4.0:\n', (file) =>
      assert.throws(() => parseLockfilePackages(file), /Malformed snapshot indentation/, String(depth)))
  }
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n    dependencies:\n      node-forge: 1.4.0\n', (file) =>
    assert.deepEqual([...parseLockfilePackages(file).keys()], ['undici']))
})

test('even-indented nested snapshot keys cannot evade dependency inventory', () => {
  for (const nested of [
    '    node-forge@1.4.0:',
    '      node-forge@1.4.0: {}',
    "    'node-forge@1.4.0': {}",
  ]) {
    withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n' + nested + '\n', (file) =>
      assert.throws(() => parseLockfilePackages(file), /Nested resolved snapshot key/, nested))
  }
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n    dependencies:\n      node-forge: 1.4.0\n', (file) =>
    assert.deepEqual([...parseLockfilePackages(file).keys()], ['undici']))
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
    writeFileSync(mock, "globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) })\n")
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

test('a successful but redirected or off-origin audit response cannot certify a clean scan', async () => {
  const previousFetch = globalThis.fetch
  const pkgMap = new Map([['node-forge', new Set(['1.4.0'])]])
  try {
    for (const response of [
      { ok: true, status: 200, redirected: true, url: 'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', json: async () => ({}) },
      { ok: true, status: 200, redirected: false, url: 'https://untrusted.example/collect', json: async () => ({}) },
    ]) {
      globalThis.fetch = async (_url, options) => {
        assert.equal(options.redirect, 'manual')
        return response
      }
      await assert.rejects(fetchAdvisories(pkgMap), /redirected or came from an unexpected endpoint/)
    }
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('partial HTTP success must not certify a complete security audit', async () => {
  const previousFetch = globalThis.fetch
  const packages = new Map([['node-forge', new Set(['1.4.0'])]])
  try {
    for (const status of [206, 202, 204]) {
      let parsed = false
      globalThis.fetch = async (_url, options) => {
        assert.equal(options.redirect, 'manual')
        return { ok: true, status, redirected: false, json: async () => {
          parsed = true
          return {}
        } }
      }
      await assert.rejects(fetchAdvisories(packages), new RegExp('HTTP ' + status))
      assert.equal(parsed, false, 'unexpected audit body parse for HTTP ' + status)
    }
    globalThis.fetch = async () => ({
      ok: true, status: 200, redirected: false, json: async () => ({}),
    })
    assert.deepEqual(await fetchAdvisories(packages), {})
  } finally {
    globalThis.fetch = previousFetch
  }
})


test('missing or malformed HTTP status cannot certify a clean audit', async () => {
  const originalFetch = globalThis.fetch
  const packages = new Map([['node-forge', new Set(['1.4.0'])]])
  try {
    for (const status of [undefined, null, '200', NaN]) {
      let parsed = false
      globalThis.fetch = async () => ({ ok: true, status, json: async () => { parsed = true; return {} } })
      await assert.rejects(fetchAdvisories(packages), /Audit registry returned HTTP/)
      assert.equal(parsed, false)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('tab-indented snapshot records fail closed instead of disappearing from audit inventory', () => {
  for (const record of ['\tundici@7.29.1:', ' \tundici@7.29.1:', '  \tundici@7.29.1:']) {
    withLockfile('lockfileVersion: 9.0\nsnapshots:\n  node-forge@1.4.0:\n' + record + '\n', (file) =>
      assert.throws(() => parseLockfilePackages(file), /Tab indentation/))
  }
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  node-forge@1.4.0:\n    dependencies:\n      undici: 7.29.1\n', (file) =>
    assert.deepEqual([...parseLockfilePackages(file).keys()], ['node-forge']))
})

test('prototype-colliding installed package names remain in the registry request', async () => {
  const originalFetch = globalThis.fetch
  const packages = new Map([
    ['__proto__', new Set(['1.0.0'])],
    ['constructor', new Set(['2.0.0'])],
    ['node-forge', new Set(['1.4.0'])],
  ])
  try {
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body)
      assert.deepEqual(Object.keys(body).sort(), ['__proto__', 'constructor', 'node-forge'].sort())
      assert.deepEqual(Object.getOwnPropertyDescriptor(body, '__proto__').value, ['1.0.0'])
      assert.deepEqual(body.constructor, ['2.0.0'])
      return { ok: true, status: 200, redirected: false, json: async () => ({}) }
    }
    assert.deepEqual(await fetchAdvisories(packages), {})
  } finally {
    globalThis.fetch = originalFetch
  }
})


test('unexpected top-level sections cannot truncate the resolved dependency inventory', () => {
  for (const injected of [
    'other:\n  node-forge@1.4.0:',
    'packages:\n  node-forge@1.4.0:',
  ]) {
    withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n' + injected.replaceAll('\n', '\n') + '\n', (file) =>
      assert.throws(() => parseLockfilePackages(file), /Unexpected top-level section after pnpm snapshots/))
  }
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n  node-forge@1.4.0:\n'.replaceAll('\n', '\n'), (file) =>
    assert.deepEqual([...parseLockfilePackages(file).keys()], ['undici', 'node-forge']))
})


test('YAML document boundaries and bare top-level scalars cannot evade snapshot inventory', () => {
  for (const separator of ['---', '...', 'unexpected-scalar']) {
    withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n' + separator + '\n  node-forge@1.4.0:\n', (file) =>
      assert.throws(() => parseLockfilePackages(file), /Unexpected unindented content/, separator))
  }
  withLockfile('lockfileVersion: 9.0\nsnapshots:\n  undici@7.29.1:\n# harmless comment\n\n  node-forge@1.4.0:\n', (file) =>
    assert.deepEqual([...parseLockfilePackages(file).keys()], ['undici', 'node-forge']))
})
