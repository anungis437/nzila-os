import { afterAll, describe, expect, it } from 'vitest'
import { execFileSync, spawn } from 'node:child_process'
import { copyFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { DurableCivic, canonical, digest } from '../../src/slice1/store'
import { proofOperations, populate } from '../../src/slice1/scenario'
import { apply, genesis, authoritySnapshot } from '../../src/slice1/model'
import {
  storageDirectory,
  checkpointDirectory,
  repositoryRoot,
} from '../../src/slice1/authorization'
import { syntheticScenario } from '../../src/scenario'
import type { Operation } from '../../src/slice1/model'

const runId = `proof-${Date.now()}`
const file = `${runId}.sqlite`
const cli = join(repositoryRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const tsconfig = join(repositoryRoot, 'apps', 'civic', 'slice1.tsconfig.json')
const worker = join(repositoryRoot, 'apps', 'civic', 'src', 'slice1', 'worker.ts')
const args = (job: unknown) => [cli, '--tsconfig', tsconfig, worker, JSON.stringify(job)]
const run = (job: unknown) =>
  JSON.parse(execFileSync(process.execPath, args(job), { encoding: 'utf8', timeout: 180000 }))
const stores: DurableCivic[] = []
const open = (name = file) => {
  const s = new DurableCivic(name)
  stores.push(s)
  return s
}
const sA = syntheticScenario('A'),
  sB = syntheticScenario('B')
let populated: ReturnType<typeof populate>
let checkpoint: ReturnType<DurableCivic['checkpoint']>

afterAll(() => {
  for (const store of stores) store.close()
})

describe('durable synthetic continuity', () => {
  it('persists both configurations in exited processes and reconstructs exactly in fresh processes', () => {
    const writerA = run({ mode: 'populate', file, institution: 'A' })
    const writerB = run({ mode: 'populate', file, institution: 'B' })
    const recoveredA = run({ mode: 'read', file, institution: 'A' })
    const recoveredB = run({ mode: 'read', file, institution: 'B' })
    expect(recoveredA.state).toEqual(writerA.state)
    expect(recoveredB.state).toEqual(writerB.state)
    expect(recoveredA.events).toEqual(writerA.events)
    expect(recoveredA.brief.varianceDays).toBe(4)
    expect(recoveredA.brief.conflictStatus).toBe('UNRESOLVED')
    expect(recoveredA.brief.missingEvidence).toEqual(['Final deliverable', 'Actual spend'])
    expect(recoveredB.brief.missingEvidence).toEqual(['Outstanding work', 'Expenditure evidence'])
    expect(recoveredA.state.decisions[0].disposition).toBe('request_evidence')
    const store = open()
    const proof = proofOperations('A')
    populated = { ...proof, receipts: [], read: store.read(sA.principal) }
    const last = proof.operations.at(-1)!
    const replay = store.submit(sA.principal, last, 'chain-11', 1)
    expect(replay.replay).toBe(true)
    expect(store.read(sA.principal).state.decisions).toHaveLength(1)
  })

  it('reconstructs known-at and effective-time cutoffs without current-state shortcuts', () => {
    const store = open()
    expect(store.read(sA.principal, 1).state.approval).toBeNull()
    expect(store.read(sA.principal, 4).state.seed.items[0].commitment?.ceilingCad).toBe(80000)
    expect(store.read(sA.principal, 4).state.seed.items[0].observed).toBeNull()
    expect(store.read(sA.principal, 4).state.decisions).toHaveLength(0)
    expect(
      store.read(sA.principal, undefined, '2026-10-10T18:30:08Z').state.seed.items[0].observed
        ?.value,
    ).toBe(14)
    expect(
      store.read(sA.principal, undefined, '2026-10-10T18:30:08Z').state.decisions,
    ).toHaveLength(0)
    expect(
      store.read(sA.principal, 6).state.seed.evidence.some((e) => e.id === sA.observation.id),
    ).toBe(false)
  })

  it('retains old decisions and authority snapshots through supersession and later revocation/configuration', () => {
    const store = open()
    let before = store.read(sA.principal)
    const original = canonical(before.state.decisions[0])
    const supersede: Operation = {
      kind: 'decision',
      resourceId: sA.itemId,
      at: '2026-10-10T18:31:00Z',
      id: 'SYN-A-DECISION-2',
      disposition: 'change',
      rationale: 'Fictional later human changes the next action without resolving conflict',
      supersedes: 'SYN-A-DECISION-1',
    }
    store.submit(sA.principal, supersede, 'supersede', before.version)
    before = store.read(sA.principal)
    store.submit(
      sA.principal,
      {
        kind: 'configuration',
        resourceId: sA.itemId,
        at: '2026-10-10T18:32:00Z',
        configuration: { ...sA.seed.config, version: 2, materialVarianceDays: 10 },
      },
      'config-2',
      before.version,
    )
    before = store.read(sA.principal)
    store.submit(
      sA.principal,
      {
        kind: 'revoke',
        resourceId: sA.itemId,
        at: '2026-10-10T18:33:00Z',
        authorityId: sA.seed.authorities[0].id,
      },
      'revoke',
      before.version,
    )
    const later = store.read(sA.principal)
    expect(later.state.decisions).toHaveLength(2)
    expect(canonical(later.state.decisions[0])).toBe(original)
    expect(later.state.decisions[1].supersedes).toBe('SYN-A-DECISION-1')
    expect(later.state.decisions[0].snapshot.configuration.version).toBe(1)
    expect(later.state.decisions[0].snapshot.authority.revokedAt).toBeNull()
    expect(store.read(sA.principal, 13).state.decisions).toHaveLength(1)
    expect(store.read(sA.principal, 13).state.seed.authorities[0].revokedAt).toBeNull()
    expect(() =>
      store.submit(
        sA.principal,
        {
          ...supersede,
          id: 'SYN-A-DECISION-3',
          at: '2026-10-10T18:34:00Z',
          supersedes: 'SYN-A-DECISION-2',
        },
        'revoked-attempt',
        later.version,
      ),
    ).toThrow('MISSING_AUTHORITY')
    checkpoint = store.checkpoint(sA.principal, 'historical-continuity', 'SYN-SLICE1-A')
    expect(() =>
      store.submit(sA.principal, proofOperations('A').operations.at(-1)!, 'chain-11', 1),
    ).toThrow('MISSING_AUTHORITY')
    expect(checkpoint.classification).toBe('LOCAL_SYNTHETIC_PROOF_ARTIFACT')
    const restarted = run({ mode: 'read', file, institution: 'A' })
    expect(restarted.state.decisions).toEqual(later.state.decisions)
  })

  it('preserves decision-time membership and role after later membership suspension', () => {
    const name = `${runId}-membership.sqlite`,
      store = open(name)
    const proof = populate(store, 'A')
    const snapshot = canonical(proof.read.state.decisions[0].snapshot)
    store.submit(
      sA.principal,
      {
        kind: 'membership',
        resourceId: sA.itemId,
        at: '2026-10-10T18:35:00Z',
        actorId: sA.principal.actorId,
        status: 'suspended',
      },
      'suspend',
      proof.read.version,
    )
    expect(() => store.read(sA.principal)).toThrow('NOT_FOUND')
    const observer = store.read(sA.observer)
    expect(canonical(observer.state.decisions[0].snapshot)).toBe(snapshot)
  })

  it('isolates persisted institutions, including reads, receipts and supersession', () => {
    const store = open()
    expect(() => store.read({ ...sA.principal, orgId: sB.principal.orgId })).toThrow('NOT_FOUND')
    const b = store.read(sB.principal)
    expect(() =>
      store.submit(
        sB.principal,
        {
          kind: 'decision',
          resourceId: sB.itemId,
          at: '2026-10-10T18:36:00Z',
          id: 'SYN-B-CROSS',
          disposition: 'change',
          rationale: 'Fictional cross predecessor',
          supersedes: 'SYN-A-DECISION-1',
        },
        'foreign-supersession',
        b.version,
      ),
    ).toThrow('INVALID_WORKFLOW_STATE')
    expect(b.state.decisions).toHaveLength(1)
    expect(b.events.every((e) => e.orgId === sB.principal.orgId)).toBe(true)
  })

  it('detects material nested changes, missing predecessors, authority mutations and checkpoint-relative truncation in test copies', () => {
    const canonicalPath = join(storageDirectory, file)
    const original = readFileSync(canonicalPath)
    for (const mode of ['nested', 'predecessor', 'authority', 'truncate'] as const) {
      const name = `${runId}-tamper-${mode}.sqlite`
      copyFileSync(canonicalPath, join(storageDirectory, name))
      if (mode === 'truncate') {
        const anchor = `${file}-SYN-A-ORG-checkpoint.json`
        copyFileSync(
          join(checkpointDirectory, anchor),
          join(checkpointDirectory, `${name}-SYN-A-ORG-checkpoint.json`),
        )
      }
      const raw = new DatabaseSync(join(storageDirectory, name))
      raw.exec(
        'PRAGMA foreign_keys=OFF; DROP TRIGGER journal_no_update; DROP TRIGGER journal_no_delete; DROP TRIGGER receipt_no_delete; DROP TRIGGER decision_no_delete;',
      )
      const row = raw
        .prepare('SELECT envelope FROM journals WHERE org_id=? AND sequence=13')
        .get(sA.principal.orgId)!
      const event = JSON.parse(String(row.envelope))
      if (mode === 'nested') event.payload.operation.rationale = 'Fictional altered rationale'
      if (mode === 'authority') event.payload.snapshot.authority.actions = ['decide']
      if (mode === 'predecessor') event.previousHash = 'missing'
      if (mode !== 'truncate') {
        raw
          .prepare('UPDATE journals SET envelope=? WHERE org_id=? AND sequence=13')
          .run(JSON.stringify(event), sA.principal.orgId)
      } else {
        // Simulate a privileged coherent tail rewrite; checkpoint is retained separately.
        const head = raw
          .prepare('SELECT envelope,hash FROM journals WHERE org_id=? AND sequence=12')
          .get(sA.principal.orgId)!
        const priorEvent = JSON.parse(String(head.envelope))
        raw.exec(
          "DELETE FROM decisions WHERE org_id='SYN-A-ORG'; DELETE FROM receipts WHERE org_id='SYN-A-ORG' AND sequence>12; DELETE FROM journals WHERE org_id='SYN-A-ORG' AND sequence>12;",
        )
        const retained = storeStateBeforeDecision()
        raw
          .prepare('UPDATE heads SET sequence=12,hash=?,state=? WHERE org_id=?')
          .run(String(head.hash), canonical(retained), sA.principal.orgId)
        expect(digest(retained)).toBe(priorEvent.stateDigest)
      }
      raw.close()
      const damaged = open(name)
      expect(() => damaged.read(sA.principal)).toThrow('INTEGRITY_FAILED')
      damaged.close()
      writeFileSync(
        join(checkpointDirectory, `${name}-detection.json`),
        canonical({
          classification: 'LOCAL_SYNTHETIC_PROOF_ARTIFACT',
          mode,
          detected: true,
          canonicalStoreUnchanged: true,
        }) + '\n',
        { flag: 'wx' },
      )
    }
    expect(readFileSync(canonicalPath)).toEqual(original)
  })

  it('rejects direct UPDATE/DELETE on consequential history, journal and receipts', () => {
    const raw = new DatabaseSync(join(storageDirectory, file))
    try {
      for (const table of ['journals', 'decisions', 'receipts']) {
        expect(() => raw.exec(`DELETE FROM ${table} WHERE org_id='SYN-A-ORG'`)).toThrow('immutable')
        const column =
          table === 'decisions' ? 'record' : table === 'receipts' ? 'result' : 'envelope'
        expect(() =>
          raw.exec(`UPDATE ${table} SET ${column}='{}' WHERE org_id='SYN-A-ORG'`),
        ).toThrow('immutable')
      }
    } finally {
      raw.close()
    }
    expect(open().read(sA.principal).state.decisions).toHaveLength(2)
  })

  it('hashes every nested material field and treats reordered object keys equivalently', () => {
    expect(digest({ a: { x: 1, y: 2 }, b: [1, 2] })).toBe(digest({ b: [1, 2], a: { y: 2, x: 1 } }))
    expect(digest({ a: { x: 1, y: 2 } })).not.toBe(digest({ a: { x: 1, y: 3 } }))
    expect(() => canonical({ a: NaN })).toThrow('INVALID_INPUT')
  })
})

function storeStateBeforeDecision() {
  const { s, operations } = proofOperations('A')
  let state = genesis(s.seed)
  for (const op of operations.slice(0, -1)) state = apply(state, s.principal, op).state
  return state
}

describe('atomic durable commands and negative authority', () => {
  it('is idempotent for evidence, commitment, outcome and decision, with institution/operation-bounded keys', () => {
    const store = open(`${runId}-idempotent.sqlite`)
    for (const institution of ['A', 'B'] as const) {
      const { s, operations } = proofOperations(institution)
      let version = store.create(s.seed, 'same-key').sequence
      for (const [i, operation] of operations.entries()) {
        const key = `operation-${i}`
        const first = store.submit(s.principal, operation, key, version)
        const retry = store.submit(s.principal, operation, key, version)
        expect(retry.replay).toBe(true)
        expect(retry.sequence).toBe(first.sequence)
        version = first.sequence
      }
      expect(store.read(s.principal).version).toBe(13)
      expect(store.read(s.principal).state.decisions).toHaveLength(1)
      const final = operations.at(-1)!
      expect(() =>
        store.submit(
          s.principal,
          { ...final, at: '2026-10-10T18:40:00Z' },
          'operation-11',
          version,
        ),
      ).toThrow('IDEMPOTENCY_CONFLICT')
    }
  })

  it('rolls back domain, event, projection and receipt at injected transaction boundaries', () => {
    const store = open(`${runId}-rollback.sqlite`),
      { s, operations } = proofOperations('A')
    const version = store.create(s.seed, 'genesis').sequence
    const before = store.read(s.principal)
    for (const fault of ['before-append', 'after-append'] as const) {
      expect(() =>
        store.submit(s.principal, operations[0], 'retry-after-failure', version, fault),
      ).toThrow('INJECTED_FAILURE')
      expect(store.read(s.principal)).toEqual(before)
    }
    expect(store.submit(s.principal, operations[0], 'retry-after-failure', version).sequence).toBe(
      2,
    )
  })

  it('replays committed results after a writer exits before returning a response', () => {
    const name = `${runId}-crash.sqlite`,
      store = open(name),
      { s, operations } = proofOperations('A')
    store.create(s.seed, 'genesis')
    expect(() =>
      run({
        mode: 'crash-before',
        file: name,
        institution: 'A',
        operation: operations[0],
        key: 'crash-key',
        version: 1,
      }),
    ).toThrow()
    expect(store.read(s.principal).version).toBe(1)
    expect(() =>
      run({
        mode: 'crash-after',
        file: name,
        institution: 'A',
        operation: operations[0],
        key: 'crash-key',
        version: 1,
      }),
    ).toThrow()
    expect(
      run({
        mode: 'submit',
        file: name,
        institution: 'A',
        operation: operations[0],
        key: 'crash-key',
        version: 1,
      }).replay,
    ).toBe(true)
    expect(store.read(s.principal).version).toBe(2)
  })

  it('commits exactly one conflicting decision from two independent racing processes', async () => {
    const name = `${runId}-concurrency.sqlite`,
      store = open(name),
      { s, operations } = proofOperations('A')
    let version = store.create(s.seed, 'genesis').sequence
    for (const [i, operation] of operations.slice(0, -1).entries())
      version = store.submit(s.principal, operation, `op-${i}`, version).sequence
    const decide = operations.at(-1)!
    const race = (key: string) =>
      new Promise<{ code: number | null; out: string; err: string }>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          args({ mode: 'submit', file: name, institution: 'A', operation: decide, key, version }),
          { stdio: ['ignore', 'pipe', 'pipe'] },
        )
        let out = '',
          err = ''
        child.stdout.on('data', (d) => {
          out += d
        })
        child.stderr.on('data', (d) => {
          err += d
        })
        child.on('error', reject)
        child.on('close', (code) => resolve({ code, out, err }))
      })
    const results = await Promise.all([race('race-1'), race('race-2')])
    expect(results.filter((r) => r.code === 0)).toHaveLength(1)
    expect(results.find((r) => r.code !== 0)?.err).toContain('STALE_STATE')
    expect(store.read(s.principal).state.decisions).toHaveLength(1)
    expect(store.read(s.principal).version).toBe(13)
  })

  it('denies machine, nondelegated, foreign, expired and revoked authority without mutation', () => {
    const seed = syntheticScenario('A'),
      state = genesis(seed.seed)
    for (const principal of [
      seed.machine,
      seed.observer,
      { ...seed.principal, orgId: 'SYN-B-ORG' },
    ])
      expect(() => authoritySnapshot(state, principal, '2026-10-10T18:30:00Z', 'decide')).toThrow()
    const expiry = structuredClone(state)
    expiry.seed.authorities[0].expiresAt = '2026-10-10T18:30:00Z'
    expect(() =>
      authoritySnapshot(expiry, seed.principal, '2026-10-10T18:30:00Z', 'decide'),
    ).toThrow('MISSING_AUTHORITY')
    const revoked = structuredClone(state)
    revoked.seed.authorities[0].revokedAt = '2026-10-10T18:29:00Z'
    expect(() =>
      authoritySnapshot(revoked, seed.principal, '2026-10-10T18:30:00Z', 'decide'),
    ).toThrow('MISSING_AUTHORITY')
    expect(expiry.decisions).toHaveLength(0)
  })

  it('deduplicates 20 identical decision attempts from two independent processes', async () => {
    const name = `${runId}-same-key-race.sqlite`,
      store = open(name)
    const { s, operations } = proofOperations('A')
    let version = store.create(s.seed, 'genesis').sequence
    for (const [i, operation] of operations.slice(0, -1).entries())
      version = store.submit(s.principal, operation, `prepare-${i}`, version).sequence
    const race = () =>
      new Promise<{ code: number | null; out: string; err: string }>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          args({
            mode: 'retry-batch',
            file: name,
            institution: 'A',
            operation: operations.at(-1),
            key: 'same-decision',
            version,
          }),
          { stdio: ['ignore', 'pipe', 'pipe'] },
        )
        let out = '',
          err = ''
        child.stdout.on('data', (d) => {
          out += d
        })
        child.stderr.on('data', (d) => {
          err += d
        })
        child.on('error', reject)
        child.on('close', (code) => resolve({ code, out, err }))
      })
    const raced = await Promise.all([race(), race()])
    for (const result of raced) expect(result.code, result.err).toBe(0)
    const responses = raced.flatMap((result) => JSON.parse(result.out))
    expect(responses).toHaveLength(20)
    expect(responses.filter((result) => !result.replay)).toHaveLength(1)
    expect(new Set(responses.map((result) => result.hash)).size).toBe(1)
    expect(store.read(s.principal).version).toBe(13)
    expect(store.read(s.principal).state.decisions).toHaveLength(1)
  })

  it('rejects storage path escape and non-synthetic fixtures', () => {
    expect(() => open('..\\outside.sqlite')).toThrow('STORAGE_PATH_INVALID')
    const seed = structuredClone(sA.seed)
    seed.institution.name = 'Real Office'
    expect(() => genesis(seed)).toThrow('SYNTHETIC_SCOPE_INVALID')
    expect(existsSync(join(checkpointDirectory, `${file}-SYN-A-ORG-checkpoint.json`))).toBe(true)
    expect(checkpoint.auditHead).toBe(open().read(sA.principal).events.at(-1)!.hash)
    expect(populated.read.state.decisions[0].unresolvedConflict).toBe(true)
  })
})
