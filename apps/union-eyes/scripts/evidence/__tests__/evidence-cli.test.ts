import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateSeal } from '../../../../../packages/os-core/src/evidence/seal'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..')
const SCRIPTS = join(ROOT, 'apps/union-eyes/scripts/evidence')
const LOADER = createRequire(import.meta.url).resolve('tsx/esm')
const KEY = 'synthetic-evidence-cli-regression-key-32chars'
const pending: string[] = []

afterEach(() => { for (const directory of pending.splice(0)) rmSync(directory, { recursive: true, force: true }) })

function fixture(implementation?: string) {
  const directory = mkdtempSync(join(tmpdir(), 'ue-evidence-cli-'))
  pending.push(directory)
  const dependency = join(directory, 'node_modules/@nzila/os-core')
  mkdirSync(dirname(dependency), { recursive: true })
  if (implementation === undefined) symlinkSync(join(ROOT, 'packages/os-core'), dependency, 'dir')
  else {
    mkdirSync(dependency)
    writeFileSync(join(dependency, 'package.json'), JSON.stringify({ name: '@nzila/os-core', type: 'module', exports: { './evidence/seal': './seal.mjs' } }))
    writeFileSync(join(dependency, 'seal.mjs'), implementation)
  }
  for (const name of ['collect', 'seal', 'verify']) writeFileSync(join(directory, `${name}.mjs`), readFileSync(join(SCRIPTS, `${name}.mjs`)))
  const bytes = Buffer.from('controlled synthetic proof\n')
  writeFileSync(join(directory, 'report.txt'), bytes)
  const pack = {
    packId: 'controlled-regression', source: 'union-eyes', schemaVersion: '1.0', generatedAt: '2026-11-17T00:00:00.000Z',
    commitSha: 'a'.repeat(40), runId: 'local-controlled-regression',
    artifacts: [{ name: 'synthetic-report', category: 'unit-tests', path: 'report.txt', sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }],
  }
  const save = (key: string | undefined = KEY) => {
    writeFileSync(join(directory, 'pack.json'), JSON.stringify(pack))
    writeFileSync(join(directory, 'seal.json'), JSON.stringify(generateSeal(pack, { hmacKey: key ?? '', sealedAt: '2026-11-17T00:00:00.000Z' })))
  }
  save()
  writeFileSync(join(directory, 'artifacts.json'), JSON.stringify(pack))
  const run = (name: 'collect' | 'seal' | 'verify', env: Record<string, string | undefined> = {}, extraArgs: string[] = []) => spawnSync(
    process.execPath, ['--import', LOADER, join(directory, `${name}.mjs`), '--output', directory, '--base-path', directory, ...extraArgs],
    { cwd: ROOT, encoding: 'utf8', timeout: 20_000, env: { ...process.env, NODE_ENV: 'test', EVIDENCE_SEAL_KEY: KEY, ...env } },
  )
  const mutateSeal = (change: (seal: Record<string, unknown>) => void) => {
    const seal = JSON.parse(readFileSync(join(directory, 'seal.json'), 'utf8'))
    change(seal)
    writeFileSync(join(directory, 'seal.json'), JSON.stringify(seal))
  }
  return { directory, pack, save, run, mutateSeal }
}

describe('actual Union Eyes evidence CLI integrity', () => {
  it('collects explicit nested proof files alongside defaults and verifies their real bytes through sealing', () => {
    const f = fixture()
    mkdirSync(join(f.directory, 'proofs'))
    writeFileSync(join(f.directory, 'proofs/receipt.json'), '{"synthetic":true}\n')
    writeFileSync(join(f.directory, 'audit-report.json'), '{"syntheticAudit":true}\n')
    const collected = f.run('collect', {}, ['--include-file', 'report.txt', '--include-file', 'proofs/receipt.json'])
    expect(collected.status, collected.stderr).toBe(0)
    const manifest = JSON.parse(readFileSync(join(f.directory, 'artifacts.json'), 'utf8'))
    expect(manifest.artifacts.map((artifact: { name: string }) => artifact.name)).toEqual(['pnpm-audit', 'report.txt', 'proofs/receipt.json'])
    for (const artifact of manifest.artifacts) {
      const bytes = readFileSync(join(f.directory, artifact.path))
      expect(artifact.sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
      expect(artifact.sizeBytes).toBe(bytes.length)
    }
    expect(f.run('seal').status).toBe(0)
    expect(f.run('verify').status).toBe(0)
    writeFileSync(join(f.directory, 'proofs/receipt.json'), '{"tampered":true}\n')
    expect(f.run('verify').status).toBe(1)
  })

  it('does not replace an existing manifest when an explicit proof is missing or is a directory', () => {
    const f = fixture()
    const before = readFileSync(join(f.directory, 'artifacts.json'), 'utf8')
    expect(f.run('collect', {}, ['--include-file', 'missing-proof.json']).status).toBe(1)
    expect(readFileSync(join(f.directory, 'artifacts.json'), 'utf8')).toBe(before)
    mkdirSync(join(f.directory, 'proofs'))
    expect(f.run('collect', {}, ['--include-file', 'proofs']).status).toBe(1)
    expect(readFileSync(join(f.directory, 'artifacts.json'), 'utf8')).toBe(before)
  })

  it('rejects explicit parent traversal and absolute paths before writing the manifest', () => {
    const f = fixture()
    const before = readFileSync(join(f.directory, 'artifacts.json'), 'utf8')
    for (const path of ['../report.txt', join(f.directory, 'report.txt'), 'C:\\outside\\proof.json']) {
      expect(f.run('collect', {}, ['--include-file', path]).status).toBe(1)
      expect(readFileSync(join(f.directory, 'artifacts.json'), 'utf8')).toBe(before)
    }
  })

  it('rejects symlink escapes for both explicit files and optional default scan paths', () => {
    const f = fixture()
    const outside = mkdtempSync(join(tmpdir(), 'ue-evidence-outside-'))
    pending.push(outside)
    writeFileSync(join(outside, 'outside.json'), '{}')
    symlinkSync(join(outside, 'outside.json'), join(f.directory, 'escaped.json'))
    expect(f.run('collect', {}, ['--include-file', 'escaped.json']).status).toBe(1)
    symlinkSync(join(outside, 'outside.json'), join(f.directory, 'audit-report.json'))
    expect(f.run('collect').status).toBe(1)
  })

  it('deduplicates the same proof but rejects conflicting artifact names before manifest replacement', () => {
    const f = fixture()
    expect(f.run('collect', {}, ['--include-file', 'report.txt', '--include-file', './report.txt']).status).toBe(0)
    const before = readFileSync(join(f.directory, 'artifacts.json'), 'utf8')
    expect(JSON.parse(before).artifacts).toHaveLength(1)
    writeFileSync(join(f.directory, 'audit-report.json'), '{"original":true}')
    writeFileSync(join(f.directory, 'pnpm-audit'), '{"conflicting":true}')
    expect(f.run('collect', {}, ['--include-file', 'pnpm-audit']).status).toBe(1)
    expect(readFileSync(join(f.directory, 'artifacts.json'), 'utf8')).toBe(before)
  })

  it('rejects recursive inclusion of the collector output itself', () => {
    const f = fixture()
    const before = readFileSync(join(f.directory, 'artifacts.json'), 'utf8')
    expect(f.run('collect', {}, ['--include-file', 'artifacts.json']).status).toBe(1)
    expect(readFileSync(join(f.directory, 'artifacts.json'), 'utf8')).toBe(before)
    symlinkSync(f.directory, join(f.directory, 'output-alias'), 'dir')
    expect(f.run('collect', {}, ['--output', join(f.directory, 'output-alias'), '--include-file', 'artifacts.json']).status).toBe(1)
    expect(readFileSync(join(f.directory, 'artifacts.json'), 'utf8')).toBe(before)
  })

  it('seals and verifies authentic indexed artifact bytes with the configured HMAC', () => {
    const f = fixture()
    expect(f.run('seal').status).toBe(0)
    const verified = f.run('verify')
    expect(verified.status, verified.stderr).toBe(0)
    expect(verified.stdout).toContain('HMAC verified')
  })

  it('rejects removal of HMAC authentication while the verifier has its configured key', () => {
    const f = fixture()
    f.mutateSeal((seal) => { delete seal.hmacSignature; delete seal.hmacKeyId })
    expect(f.run('verify').status).toBe(1)
  })

  it('rejects the wrong key and absence of the signing key', () => {
    const f = fixture()
    expect(f.run('verify', { EVIDENCE_SEAL_KEY: 'different-synthetic-key' }).status).toBe(1)
    expect(f.run('verify', { EVIDENCE_SEAL_KEY: undefined }).status).toBe(1)
  })

  it('rejects a forged signature and an altered key identifier', () => {
    const f = fixture()
    f.mutateSeal((seal) => { seal.hmacSignature = '0'.repeat(64) })
    expect(f.run('verify').status).toBe(1)
    f.save()
    f.mutateSeal((seal) => { seal.hmacKeyId = '00000000' })
    expect(f.run('verify').status).toBe(1)
  })

  it('rejects changed index data even while the recorded artifact hash is unchanged', () => {
    const f = fixture()
    f.pack.artifacts[0]!.category = 'forged-classification'
    writeFileSync(join(f.directory, 'pack.json'), JSON.stringify(f.pack))
    expect(f.run('verify').status).toBe(1)
  })

  it('rejects changed or missing artifact files despite a valid authenticated index', () => {
    const f = fixture()
    writeFileSync(join(f.directory, 'report.txt'), 'tampered bytes')
    expect(f.run('verify').status).toBe(1)
    rmSync(join(f.directory, 'report.txt'))
    expect(f.run('verify').status).toBe(1)
  })

  it('rejects parent traversal and symlinks outside the declared artifact base', () => {
    const outside = mkdtempSync(join(tmpdir(), 'ue-evidence-outside-'))
    pending.push(outside)
    writeFileSync(join(outside, 'outside.txt'), 'outside')
    const f = fixture()
    f.pack.artifacts[0]!.path = '../outside.txt'
    f.save()
    expect(f.run('verify').status).toBe(1)
    symlinkSync(join(outside, 'outside.txt'), join(f.directory, 'escaped.txt'))
    f.pack.artifacts[0]!.path = 'escaped.txt'
    f.save()
    const verified = f.run('verify')
    expect(verified.status).toBe(1)
    expect(verified.stderr).toContain('outside the artifact base path')
  })

  it('retains explicitly unsigned local digest verification without claiming HMAC authentication', () => {
    const f = fixture()
    f.save('')
    const verified = f.run('verify', { EVIDENCE_SEAL_KEY: undefined })
    expect(verified.status, verified.stderr).toBe(0)
    expect(verified.stdout).toContain('unsigned digest only')
  })

  it('requires a configured production signing key for both seal and verify', () => {
    const f = fixture()
    for (const key of [undefined, 'short']) {
      expect(f.run('seal', { NODE_ENV: 'production', EVIDENCE_SEAL_KEY: key }).status).toBe(1)
      expect(f.run('verify', { NODE_ENV: 'production', EVIDENCE_SEAL_KEY: key }).status).toBe(1)
    }
  })

  it('fails when the authoritative signer throws without writing a replacement unsigned seal', () => {
    const f = fixture('export function generateSeal(){throw new Error("controlled signer unavailable")}')
    const before = readFileSync(join(f.directory, 'seal.json'), 'utf8')
    const sealed = f.run('seal')
    expect(sealed.status).toBe(1)
    expect(sealed.stderr).toContain('controlled signer unavailable')
    expect(readFileSync(join(f.directory, 'seal.json'), 'utf8')).toBe(before)
  })

  it('fails when the authoritative verifier throws instead of accepting only the public digest', () => {
    const f = fixture('export function verifySeal(){throw new Error("controlled verifier unavailable")}')
    const verified = f.run('verify')
    expect(verified.status).toBe(1)
    expect(verified.stderr).toContain('controlled verifier unavailable')
  })

  it('fails on a missing authoritative module and never selects an inline implementation', () => {
    const f = fixture()
    rmSync(join(f.directory, 'node_modules/@nzila/os-core'))
    expect(f.run('seal').status).toBe(1)
    expect(f.run('verify').status).toBe(1)
  })

  it('rejects unsupported envelope algorithms and inconsistent artifact counts', () => {
    const f = fixture()
    f.mutateSeal((seal) => { seal.algorithm = 'sha1' })
    expect(f.run('verify').status).toBe(1)
    f.save()
    f.mutateSeal((seal) => { seal.artifactCount = 0 })
    expect(f.run('verify').status).toBe(1)
  })
})
