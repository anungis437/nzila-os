import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { validateAttestation } from '../../packages/runtime-attestation/src/attestation'
import { GovernanceEvidenceLedger } from '../../packages/runtime-attestation/src/ledger'

const ROOT = resolve(__dirname, '../..')
const directories: string[] = []
const sha256 = (bytes: string | Buffer) => `sha256-${createHash('sha256').update(bytes).digest('hex')}`

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'nzila-governance-integrity-'))
  directories.push(cwd)
  const evidence = join(cwd, 'actual-check.json')
  writeFileSync(evidence, '{"status":"passed","scope":"local-contracts"}\n')
  const env = {
    ...process.env,
    NZILA_RELEASE_ID: 'local-test-candidate',
    NZILA_COMMIT_SHA: 'a'.repeat(40),
    NZILA_MANIFEST_HASH: sha256('actual manifest'),
    NZILA_BUILT_AT: '2026-11-17T12:00:00.000Z',
    NZILA_ENVIRONMENT_CLASS: 'local-test',
    NZILA_PRODUCT: 'unioneyes',
    NZILA_ATTESTATION_ISSUER: 'local-contract-tests',
    NZILA_ATTESTATION_VERDICT: 'partial',
    NZILA_ATTESTATION_RATIONALE: 'Disposable local contracts passed; no environment was deployed.',
    NZILA_ATTESTATION_EVIDENCE: evidence,
  }
  const run = (script: string, args: string[] = [], overrides: Record<string, string | undefined> = {}) =>
    spawnSync(process.execPath, [join(ROOT, 'tooling/runtime-governance', script), ...args], {
      cwd, env: { ...env, ...overrides }, encoding: 'utf8',
    })
  const attestationPath = join(cwd, 'proof-artifacts/attestations/local-test-candidate/deployment.json')
  const generate = () => {
    const result = run('generate-attestation.mjs', ['--class=deployment'])
    expect(result.status, result.stderr).toBe(0)
    return JSON.parse(readFileSync(attestationPath, 'utf8'))
  }
  return { cwd, evidence, env, run, generate, attestationPath }
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('runtime governance artifact integrity', () => {
  it('emits the canonical package schema and hashes artifact bytes rather than its location', () => {
    const f = fixture()
    const attestation = validateAttestation(f.generate())
    expect(attestation.citedEvidence).toEqual([{
      id: f.evidence,
      contentHash: sha256(readFileSync(f.evidence)),
      description: 'Local qualification artifact',
    }])
    expect(attestation.subject.id).toContain(f.env.NZILA_COMMIT_SHA)
    expect(attestation.rationale).toContain(f.env.NZILA_MANIFEST_HASH)
    expect(attestation.verdict).toBe('partial')
  })

  it('changes the evidence digest when bytes at the same location change', () => {
    const f = fixture()
    const before = validateAttestation(f.generate()).citedEvidence[0].contentHash
    writeFileSync(f.evidence, '{"status":"failed"}\n')
    const result = f.run('generate-attestation.mjs', ['--class=doctrine-compliance'])
    expect(result.status, result.stderr).toBe(0)
    const after = validateAttestation(JSON.parse(readFileSync(join(f.cwd,
      'proof-artifacts/attestations/local-test-candidate/doctrine-compliance.json'), 'utf8')))
    expect(after.citedEvidence[0].contentHash).not.toBe(before)
    expect(after.citedEvidence[0].contentHash).toBe(sha256(readFileSync(f.evidence)))
  })

  it.each(['', 'github://owner/repo/runs/123', 'https://example.invalid/proof.json', 'missing.json'])(
    'refuses absent or unresolvable evidence %j', (evidence) => {
      const f = fixture()
      const result = f.run('generate-attestation.mjs', ['--class=deployment'], { NZILA_ATTESTATION_EVIDENCE: evidence })
      expect(result.status).not.toBe(0)
    },
  )

  it('defaults an unspecified verdict to unverified', () => {
    const f = fixture()
    const result = f.run('generate-attestation.mjs', ['--class=deployment'], { NZILA_ATTESTATION_VERDICT: undefined })
    expect(result.status, result.stderr).toBe(0)
    expect(validateAttestation(JSON.parse(readFileSync(f.attestationPath, 'utf8'))).verdict).toBe('unverified')
  })

  it.each([
    ['NZILA_RELEASE_ID', '../escape'],
    ['NZILA_COMMIT_SHA', 'not-a-commit'],
    ['NZILA_MANIFEST_HASH', 'sha256-pending'],
    ['NZILA_BUILT_AT', '2026-99-99'],
    ['NZILA_BUILT_AT', '2026-02-30T12:00:00.000Z'],
    ['NZILA_ATTESTATION_VERDICT', 'green'],
    ['NZILA_ATTESTATION_RATIONALE', ''],
  ])('rejects invalid release or claim metadata %s', (key, value) => {
    const f = fixture()
    expect(f.run('generate-attestation.mjs', ['--class=deployment'], { [key]: value }).status).not.toBe(0)
  })

  it('writes a canonical ledger record containing the full validated attestation and refuses replacement', () => {
    const f = fixture()
    const attestation = f.generate()
    const result = f.run('write-evidence.mjs', [`--from-attestation=${f.attestationPath}`])
    expect(result.status, result.stderr).toBe(0)
    const path = result.stdout.match(/wrote (.*?) contentHash=/)?.[1]
    expect(path).toBeTruthy()
    const bytes = readFileSync(path!, 'utf8')
    const record = JSON.parse(bytes)
    expect(new GovernanceEvidenceLedger().append(record)).toEqual(record)
    expect(record.payload.attestation).toEqual(attestation)
    expect(f.run('write-evidence.mjs', [`--from-attestation=${f.attestationPath}`]).status).not.toBe(0)
    expect(readFileSync(path!, 'utf8')).toBe(bytes)
  })

  it('refuses evidence modified after attestation issuance', () => {
    const f = fixture()
    f.generate()
    writeFileSync(f.evidence, '{"status":"failed"}\n')
    expect(f.run('write-evidence.mjs', [`--from-attestation=${f.attestationPath}`]).status).not.toBe(0)
  })

  it('allows exactly one concurrent append of the same attestation', async () => {
    const f = fixture()
    f.generate()
    const append = () => new Promise<{ status: number | null; output: string }>((resolveResult, reject) => {
      const child = spawn(process.execPath, [
        join(ROOT, 'tooling/runtime-governance/write-evidence.mjs'),
        `--from-attestation=${f.attestationPath}`,
      ], { cwd: f.cwd, env: f.env, stdio: ['ignore', 'pipe', 'pipe'] })
      let output = ''
      child.stdout.on('data', (bytes) => { output += String(bytes) })
      child.stderr.on('data', (bytes) => { output += String(bytes) })
      child.on('error', reject)
      child.on('close', (status) => resolveResult({ status, output }))
    })
    const results = await Promise.all([append(), append()])
    expect(results.map((result) => result.status).sort()).toEqual([0, 2])
    const output = results.find((result) => result.status === 0)!.output
    const path = output.match(/wrote (.*?) contentHash=/)?.[1]
    expect(path).toBeTruthy()
    expect(new GovernanceEvidenceLedger().append(JSON.parse(readFileSync(path!, 'utf8')))).toBeTruthy()
  })

  it('rejects an arbitrary object presented as an attestation', () => {
    const f = fixture()
    writeFileSync(f.attestationPath.replace('/proof-artifacts/attestations/local-test-candidate/deployment.json', '/forged.json'), '{}')
    expect(f.run('write-evidence.mjs', [`--from-attestation=${join(f.cwd, 'forged.json')}`]).status).not.toBe(0)
  })

  it('rejects path traversal in a supplied ledger identifier and nested forbidden payload identifiers', () => {
    const f = fixture()
    const ledger = {
      id: '../escape', type: 'local-check', subject: { kind: 'test', id: 'fixture' },
      scope: { product: 'unioneyes', environment: 'local-test' }, releaseId: 'local-test-candidate',
      payload: { status: 'passed' }, retentionClass: 'standard', accessClass: 'platform-only',
      writtenAt: '2026-11-17T12:00:00.000Z',
    }
    const input = join(f.cwd, 'record.json')
    writeFileSync(input, JSON.stringify(ledger))
    expect(f.run('write-evidence.mjs', [`--from-file=${input}`]).status).not.toBe(0)
    writeFileSync(input, JSON.stringify({ ...ledger, id: 'safe-id', payload: { nested: { email: 'synthetic@example.invalid' } } }))
    expect(f.run('write-evidence.mjs', [`--from-file=${input}`]).status).not.toBe(0)
  })

  it('rejects placeholder identity values at the environment gate', () => {
    const f = fixture()
    expect(f.run('check-env.mjs', [], { NZILA_MANIFEST_HASH: 'sha256-pending' }).status).not.toBe(0)
  })

  it('validates a synthetic isolated pilot boundary and rejects cross-partition or production-profile escalation', () => {
    const f = fixture()
    const input = join(f.cwd, 'boundaries.json')
    const production = { id: 'synthetic-production', environmentClass: 'production', dataPartitionKey: 'production-fixture' }
    const pilot = { id: 'synthetic-pilot', environmentClass: 'pilot', dataPartitionKey: 'pilot-fixture', featureProfiles: [] as string[] }
    const check = (scope: typeof pilot) => {
      writeFileSync(input, JSON.stringify({ scopes: [production, scope] }))
      return f.run('check-pilot-boundaries.mjs', [], { NZILA_PILOT_BOUNDARIES: input })
    }
    expect(check(pilot).status).toBe(0)
    expect(check({ ...pilot, dataPartitionKey: production.dataPartitionKey }).status).toBe(2)
    expect(check({ ...pilot, featureProfiles: ['production:privileged'] }).status).toBe(2)
  })
})
