import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  Slice2Store,
  canonical,
  digest,
  eventDigest,
  type Event,
  type Operation,
} from '../../src/slice2/store'
import { publishAnchor, verifyAnchor, trustedPin } from '../../src/slice2/anchor'
import { proofOperations } from '../../src/slice1/scenario'
import { apply, genesis } from '../../src/slice1/model'
import {
  storageDirectory,
  checkpointDirectory,
  adversarialDirectory,
  authorizeRuntime,
} from '../../src/slice2/authorization'
import { launch, runWorker, retain, environment, guardLog } from '../../src/slice2/harness'

const id = `hardening-${Date.now()}`
const evidence: Record<string, unknown[]> = {
  schedules: [],
  crashes: [],
  integrity: [],
  negatives: [],
}
const opened: Slice2Store[] = []
const baselines = new Map<string, string>()
const open = (file: string, options?: ConstructorParameters<typeof Slice2Store>[1]) => {
  const store = new Slice2Store(file, options)
  opened.push(store)
  return store
}
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})
afterAll(() => {
  for (const store of opened) store.close()
  retain(`${id}-results.json`, {
    environment: environment(),
    evidence,
    authorizationCalls: guardLog(),
    classification: 'LOCAL_SYNTHETIC_PROOF_ARTIFACT',
    humanAcceptance: 'NOT_CLAIMED',
  })
})
function prepare(file: string, institution: 'A' | 'B' = 'A', expiresAt?: string) {
  const { s, operations } = proofOperations(institution)
  const seed = structuredClone(s.seed)
  if (expiresAt) seed.authorities[0].expiresAt = expiresAt
  const baselineKey = `${institution}-${expiresAt ?? 'default'}`
  let baseline = baselines.get(baselineKey)
  if (!baseline) {
    baseline = `${id}-baseline-${baselines.size}.sqlite`
    const store = open(baseline)
    store.create(seed)
    store.submit(s.principal, operations[0], 'authorize', 1)
    store.close()
    baselines.set(baselineKey, baseline)
  }
  copyFileSync(join(storageDirectory, baseline), join(storageDirectory, file))
  const version = 2
  const decision = operations.at(-1)! as Extract<Operation, { kind: 'decision' }>
  const revoke: Operation = {
    kind: 'revoke',
    resourceId: s.itemId,
    authorityId: seed.authorities[0].id,
    at: '2026-10-10T18:31:00Z',
  }
  return { s, decision, revoke, version, file, institution }
}
function job(p: ReturnType<typeof prepare>, operation: Operation, key: string) {
  return {
    mode: 'submit' as const,
    file: p.file,
    institution: p.institution,
    operation,
    key,
    version: p.version,
  }
}
async function recovered(p: ReturnType<typeof prepare>) {
  const result = await runWorker({ mode: 'read', file: p.file, institution: p.institution })
  expect(result.code, result.stderr + JSON.stringify(result.message)).toBe(0)
  return result.message!.result as ReturnType<Slice2Store['read']>
}
function assertDenial(result: Awaited<ReturnType<typeof runWorker>>, code = 'MISSING_AUTHORITY') {
  expect(result.code, result.stderr + JSON.stringify(result.message)).toBe(1)
  expect(result.message?.error).toContain(code)
}
async function repetitions(run: (repetition: number) => Promise<void>) {
  for (let offset = 0; offset < 20; offset += 4) {
    const results = await Promise.allSettled(Array.from({ length: 4 }, (_, i) => run(offset + i)))
    retain(`${id}-schedule-batch-${evidence.schedules.length}.json`, {
      evidence,
      authorizationCalls: guardLog(),
      batchOffset: offset,
      results: results.map((r) => ({
        status: r.status,
        error: r.status === 'rejected' ? String(r.reason) : null,
      })),
    })
    const failure = results.find((result) => result.status === 'rejected')
    if (failure?.status === 'rejected') throw failure.reason
  }
}

describe('uncached admission and negative institutional authority', () => {
  it('checks actual governance at construction/admission/precommit and excludes proof clock from governance', () => {
    authorizeRuntime()
    const p = prepare(`${id}-governance.sqlite`)
    const store = open(p.file, { proofClock: () => '2026-10-12T15:00:00Z' })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-19T14:38:49.533Z'))
    expect(() => store.read(p.s.principal)).toThrow('ineffective or expired')
    expect(() => open(`${id}-expired-new.sqlite`)).toThrow('ineffective or expired')
    vi.useRealTimers()
    const precommit = open(p.file, {
      hook: (stage) => {
        if (stage === 'precommit') {
          vi.useFakeTimers()
          vi.setSystemTime(new Date('2026-10-19T14:38:49.533Z'))
        }
      },
    })
    expect(() => precommit.submit(p.s.principal, p.decision, 'expires-in-work', 2)).toThrow(
      'ineffective or expired',
    )
    vi.useRealTimers()
    expect(store.read(p.s.principal).version).toBe(2)
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => open(`${id}-production.sqlite`)).toThrow('production prohibited')
  })
  it('denies machine, observer, foreign org/resource, expired instrument-backed delegation and suspended member', () => {
    const p = prepare(`${id}-negative.sqlite`)
    const store = open(p.file)
    for (const [name, principal, operation] of [
      ['machine', p.s.machine, p.decision],
      ['membership-only', p.s.observer, p.decision],
      ['foreign-org', { ...p.s.principal, orgId: 'SYN-B-ORG' }, p.decision],
      ['foreign-resource', p.s.principal, { ...p.decision, resourceId: 'SYN-B-ITEM' }],
      ['foreign-revocation', p.s.principal, { ...p.revoke, authorityId: 'SYN-B-AUTHORITY' }],
    ] as const) {
      expect(() => store.submit(principal, operation, `deny-${name}`, 2)).toThrow()
      expect(store.read(p.s.principal).version).toBe(2)
      evidence.negatives.push({ name, effect: 'NO_JOURNAL_OR_RECEIPT' })
    }
    const expired = prepare(`${id}-expired-delegation.sqlite`, 'B', '2026-11-01T00:00:00Z')
    expect(() =>
      open(expired.file, { proofClock: () => '2026-11-02T00:00:00Z' }).submit(
        expired.s.principal,
        expired.decision,
        'old-at',
        2,
      ),
    ).toThrow('MISSING_AUTHORITY')
    const instrumentSeed = structuredClone(p.s.seed)
    Object.assign(instrumentSeed.instruments[0], {
      effectiveAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-11-01T00:00:00Z',
    })
    const instrument = open(`${id}-expired-instrument.sqlite`)
    instrument.create(instrumentSeed)
    instrument.submit(p.s.principal, proofOperations('A').operations[0], 'authorize', 1)
    const expiredInstrument = open(`${id}-expired-instrument.sqlite`, {
      proofClock: () => '2026-11-02T00:00:00Z',
    })
    expect(() =>
      expiredInstrument.submit(p.s.principal, p.decision, 'instrument-expired', 2),
    ).toThrow('MISSING_AUTHORITY')
    const before = store.submit(p.s.principal, p.decision, 'prior', 2)
    expect(() =>
      store.submit(
        p.s.principal,
        { ...p.decision, rationale: 'Fictional changed payload' },
        'prior',
        before.sequence,
      ),
    ).toThrow('IDEMPOTENCY_CONFLICT')
    const snap = canonical(store.read(p.s.principal).state.decisions[0])
    store.submit(
      p.s.principal,
      {
        kind: 'membership',
        actorId: p.s.principal.actorId,
        status: 'suspended',
        resourceId: p.s.itemId,
        at: p.revoke.at,
      },
      'suspend',
      before.sequence,
    )
    expect(() => store.submit(p.s.principal, p.decision, 'prior', 2)).toThrow('NOT_FOUND')
    expect(canonical(store.read(p.s.observer).state.decisions[0])).toBe(snap)
    expect(() => open('..\\escape.sqlite')).toThrow('STORAGE_PATH_INVALID')
  })
})

describe('two-process forced authority schedules; 20 repetitions each', () => {
  it('revocation wins before writer lock; identical stale retry is denied before receipt/version', async () => {
    await repetitions(async (repetition) => {
      const p = prepare(`${id}-revocation-${repetition}.sqlite`, repetition % 2 ? 'B' : 'A')
      const decision = launch({ ...job(p, p.decision, 'decision'), pause: 'preliminary' })
      const preliminary = await decision.wait('barrier', 'preliminary')
      const revoke = await runWorker(job(p, p.revoke, 'revoke'))
      expect(revoke.code, JSON.stringify(revoke)).toBe(0)
      decision.resume()
      const outcome = await decision.exit
      const denial = outcome.messages.find((m) => m.type === 'result')
      expect(outcome.code).toBe(1)
      expect(denial?.error).toContain('MISSING_AUTHORITY')
      const retry = await runWorker(job(p, p.decision, 'decision'))
      assertDenial(retry)
      const read = await recovered(p)
      expect(read.version).toBe(3)
      expect(read.state.decisions).toHaveLength(0)
      evidence.schedules.push({
        schedule: 'revocation-wins',
        repetition,
        preliminary,
        revoke,
        outcome,
        retry,
        sequence: read.events.map((e) => [
          e.sequence,
          e.payload.kind === 'operation' ? e.payload.operation.kind : 'genesis',
        ]),
      })
    })
  })
  it('decision lock wins; revoker observes SQLITE_BUSY then waits on bounded IPC; historical decision survives revoked retry', async () => {
    await repetitions(async (repetition) => {
      const p = prepare(`${id}-decision-${repetition}.sqlite`, repetition % 2 ? 'B' : 'A')
      const decision = launch({ ...job(p, p.decision, 'decision'), mode: 'race', pause: 'locked' })
      const revoke = launch({
        ...job(p, p.revoke, 'revoke'),
        mode: 'race',
        observeBusy: true,
        reloadOnStale: true,
      })
      await Promise.all([decision.wait('barrier', 'start'), revoke.wait('barrier', 'start')])
      decision.resume()
      await decision.wait('barrier', 'locked')
      revoke.resume()
      const waiting = await revoke.wait('barrier', 'lock-wait')
      decision.resume()
      const decisionResult = await decision.exit
      expect(decisionResult.code, JSON.stringify(decisionResult)).toBe(0)
      revoke.resume()
      const revokeResult = await revoke.exit
      expect(revokeResult.code, JSON.stringify(revokeResult)).toBe(0)
      expect(revokeResult.messages.find((m) => m.type === 'result')?.retryEvidence?.[0]).toEqual({
        error: 'CivicDiagnostic: STALE_STATE: Reload latest revision',
        reloadedRevision: 3,
      })
      const revocation = revokeResult
      expect(revocation.code, JSON.stringify(revocation)).toBe(0)
      const retry = await runWorker(job(p, p.decision, 'decision'))
      assertDenial(retry)
      const read = await recovered(p)
      expect(read.version).toBe(4)
      expect(read.state.decisions).toHaveLength(1)
      expect(read.state.decisions[0].snapshot.authority.revokedAt).toBeNull()
      expect(read.events[2].payload.kind).toBe('operation')
      const historical = open(p.file).read(p.s.principal, 3)
      expect(historical.state.seed.authorities[0].revokedAt).toBeNull()
      expect(historical.state.decisions).toEqual(read.state.decisions)
      evidence.schedules.push({
        schedule: 'decision-wins-and-committed-retry',
        repetition,
        waiting,
        decisionResult,
        revokeResult,
        revocation,
        retry,
        events: read.events,
      })
    })
  })
  it('expiry during locked work rolls back; independent observer reads only committed predecessor', async () => {
    await repetitions(async (repetition) => {
      const p = prepare(
        `${id}-expiry-${repetition}.sqlite`,
        repetition % 2 ? 'B' : 'A',
        '2026-11-01T00:00:00Z',
      )
      const decision = launch({
        ...job(p, p.decision, 'decision'),
        pause: 'precommit',
        proofClock: '2026-10-12T15:00:00Z',
      })
      const paused = await decision.wait('barrier', 'precommit')
      const observer = await runWorker({ mode: 'read', file: p.file, institution: p.institution })
      expect(observer.code, JSON.stringify(observer)).toBe(0)
      expect((observer.message!.result as ReturnType<Slice2Store['read']>).version).toBe(2)
      decision.resume('2026-11-02T00:00:00Z')
      const outcome = await decision.exit
      expect(outcome.code).toBe(1)
      expect(outcome.messages.find((m) => m.type === 'result')?.error).toContain(
        'MISSING_AUTHORITY',
      )
      expect((await recovered(p)).version).toBe(2)
      evidence.schedules.push({
        schedule: 'expiry-during-work',
        repetition,
        paused,
        observer,
        outcome,
      })
    })
  })
  it('rolled-back key cannot resurrect authority after revocation', async () => {
    await repetitions(async (repetition) => {
      const p = prepare(`${id}-rollback-${repetition}.sqlite`, repetition % 2 ? 'B' : 'A')
      const failed = await runWorker({ ...job(p, p.decision, 'decision'), crash: 'after-append' })
      expect(failed.code).toBe(73)
      const revoke = await runWorker(job(p, p.revoke, 'revoke'))
      expect(revoke.code, JSON.stringify(revoke)).toBe(0)
      const retry = await runWorker(job(p, p.decision, 'decision'))
      assertDenial(retry)
      const read = await recovered(p)
      expect(read.version).toBe(3)
      expect(read.state.decisions).toHaveLength(0)
      evidence.schedules.push({
        schedule: 'rolled-back-revoked-retry',
        repetition,
        failed,
        revoke,
        retry,
      })
    })
  })
  it('contested starts produce exactly one legal serial order in distinct processes', async () => {
    await repetitions(async (repetition) => {
      const p = prepare(`${id}-contested-${repetition}.sqlite`, repetition % 2 ? 'B' : 'A')
      const decision = launch({ ...job(p, p.decision, 'decision'), mode: 'race' })
      const revoke = launch({ ...job(p, p.revoke, 'revoke'), mode: 'race' })
      const barriers = await Promise.all([
        decision.wait('barrier', 'start'),
        revoke.wait('barrier', 'start'),
      ])
      expect(barriers[0].pid).not.toBe(barriers[1].pid)
      decision.resume()
      revoke.resume()
      const [d, r] = await Promise.all([decision.exit, revoke.exit])
      let revocation = r
      if (d.code === 0) {
        expect(r.messages.find((m) => m.type === 'result')?.error).toContain('STALE_STATE')
        revocation = await runWorker({ ...job(p, p.revoke, 'revoke'), version: 3 })
      } else {
        expect(d.messages.find((m) => m.type === 'result')?.error).toContain('MISSING_AUTHORITY')
      }
      expect(revocation.code, JSON.stringify(revocation)).toBe(0)
      const read = await recovered(p)
      expect(read.state.decisions).toHaveLength(d.code === 0 ? 1 : 0)
      expect(read.state.seed.authorities[0].revokedAt).toBe(p.revoke.at)
      for (const e of read.events.slice(1)) expect(e.actualAuthorityRevision).toBe(e.sequence - 1)
      evidence.schedules.push({
        schedule: 'contested-start',
        repetition,
        barriers,
        d,
        r,
        revocation,
        events: read.events,
      })
    })
  })
})

describe('recovery, isolated replay and independent custody anchor', () => {
  it('crashes at every transaction/publication window; exited fresh readers preserve only committed effects', async () => {
    for (const stage of [
      'before-lock',
      'locked',
      'before-append',
      'after-append',
      'precommit',
      'committed',
    ] as const) {
      const p = prepare(`${id}-crash-${stage}.sqlite`)
      const store = open(p.file)
      const cp = store.checkpoint(p.s.principal, `${id}-crash-${stage}.json`, 'SYN-CRASH')
      const anchored = publishAnchor(cp, `${id}-crash-${stage}`, 'SYN-SLICE2')
      store.close()
      const crash = await runWorker({ ...job(p, p.decision, 'response-loss'), crash: stage })
      expect(crash.code).toBe(73)
      const fresh = await recovered(p)
      const committed = stage === 'committed'
      expect(fresh.version).toBe(committed ? 3 : 2)
      expect(fresh.state.decisions).toHaveLength(committed ? 1 : 0)
      const reopened = open(p.file)
      const check = verifyAnchor(
        reopened,
        p.s.principal,
        cp,
        anchored.anchor,
        trustedPin(`${id}-crash-${stage}`),
      )
      expect(check.status).toBe(
        committed ? 'UNANCHORED_PENDING_REVIEW' : 'ANCHORED_PREFIX_VERIFIED',
      )
      const retry = reopened.submit(p.s.principal, p.decision, 'response-loss', 2)
      expect(retry.replay).toBe(committed)
      expect(reopened.read(p.s.principal).version).toBe(3)
      expect(verifyAnchor(reopened, p.s.principal, cp, anchored.anchor, anchored.pin).status).toBe(
        'UNANCHORED_PENDING_REVIEW',
      )
      expect(trustedPin(`${id}-crash-${stage}`).expectedDigest).toBe(anchored.pin.expectedDigest)
      evidence.crashes.push({
        stage,
        crash,
        check,
        retry,
        publicationGap: 'NO_SILENT_ANCHOR_REPAIR',
      })
    }
  })
  it('reconstructs deterministic known/effective cutoffs and preserves org-specific receipts and decisions', async () => {
    const file = `${id}-isolation.sqlite`
    const store = open(file)
    for (const institution of ['A', 'B'] as const) {
      const { s, operations } = proofOperations(institution)
      let version = store.create(s.seed).sequence
      for (const [i, operation] of operations.entries())
        version = store.submit(s.principal, operation, `chain-${i}`, version).sequence
      const now = store.read(s.principal)
      let state = genesis(s.seed)
      for (const operation of operations) state = apply(state, s.principal, operation).state
      expect(now.state).toEqual(state)
      expect(now.brief.conflictStatus).toBe('UNRESOLVED')
      expect(now.brief.varianceDays).toBe(4)
      expect(store.read(s.principal, 1).state.approval).toBeNull()
      expect(store.read(s.principal, 12).state.decisions).toHaveLength(0)
      expect(
        store.read(s.principal, undefined, '2026-10-10T18:30:08Z').state.decisions,
      ).toHaveLength(0)
      const retry = store.submit(s.principal, operations.at(-1)!, 'chain-11', 1)
      expect(retry.replay).toBe(true)
      expect(store.read(s.principal).state).toEqual(now.state)
      const fresh = await runWorker({ mode: 'read', file, institution })
      expect(fresh.code, JSON.stringify(fresh)).toBe(0)
      expect((fresh.message!.result as ReturnType<Slice2Store['read']>).state).toEqual(state)
    }
    const sA = proofOperations('A').s,
      sB = proofOperations('B').s
    expect(() => store.read({ ...sA.principal, orgId: sB.principal.orgId })).toThrow('NOT_FOUND')
    expect(store.read(sB.principal).events.every((e) => e.orgId === sB.principal.orgId)).toBe(true)
  })
  it('detects all declared copied store/checkpoint attacks, coherent rewrite/truncation and stale/foreign anchor without repairs', () => {
    const p = prepare(`${id}-canonical.sqlite`)
    const store = open(p.file)
    const oldCp = store.checkpoint(p.s.principal, `${id}-old.json`, 'SYN-INTEGRITY')
    const oldAnchor = publishAnchor(oldCp, `${id}-old`, 'SYN-SLICE2')
    store.submit(p.s.principal, p.decision, 'decision', 2)
    const cp = store.checkpoint(p.s.principal, `${id}-current.json`, 'SYN-INTEGRITY')
    const current = publishAnchor(cp, `${id}-current`, 'SYN-SLICE2', oldAnchor.anchor)
    const read = store.read(p.s.principal)
    store.close()
    const canonicalBytes = readFileSync(join(storageDirectory, p.file))
    const checkpointBytes = readFileSync(join(checkpointDirectory, `${id}-current.json`))
    const pin = trustedPin(`${id}-current`)
    for (const attack of [
      'store-only',
      'checkpoint-only',
      'inconsistent-both',
      'coherent-both',
      'coherent-truncation',
      'reordering',
      'nested-event',
      'authority',
      'decision-row',
      'receipt-row',
      'stale-anchor',
      'foreign-checkpoint',
    ] as const) {
      const copyName = `${id}-attack-${attack}.sqlite`
      copyFileSync(join(storageDirectory, p.file), join(adversarialDirectory, copyName))
      let checkpoint = structuredClone(cp)
      let anchor = structuredClone(current.anchor)
      const raw = new DatabaseSync(join(adversarialDirectory, copyName))
      raw.exec(
        'PRAGMA foreign_keys=OFF; DROP TRIGGER journal_no_update; DROP TRIGGER journal_no_delete; DROP TRIGGER receipt_no_update; DROP TRIGGER receipt_no_delete; DROP TRIGGER decision_no_update; DROP TRIGGER decision_no_delete;',
      )
      if (['store-only', 'inconsistent-both'].includes(attack))
        raw.exec("UPDATE heads SET state='{}' WHERE org_id='SYN-A-ORG'")
      if (['checkpoint-only', 'inconsistent-both'].includes(attack))
        checkpoint.stateDigest = digest({ syntheticOnly: true })
      if (attack === 'foreign-checkpoint') checkpoint.orgId = 'SYN-B-ORG'
      if (attack === 'decision-row')
        raw.exec("UPDATE decisions SET record='{}' WHERE org_id='SYN-A-ORG'")
      if (attack === 'receipt-row')
        raw.exec("UPDATE receipts SET result='{}' WHERE org_id='SYN-A-ORG' AND sequence=3")
      if (['nested-event', 'authority', 'reordering'].includes(attack)) {
        const event = structuredClone(read.events[2])
        if (event.payload.kind !== 'operation') throw new Error('fixture')
        if (attack === 'nested-event' && event.payload.operation.kind === 'decision')
          event.payload.operation.rationale = 'Fictional tampered nested event'
        if (attack === 'authority') event.payload.finalSnapshot.authority.actions = ['decide']
        if (attack === 'reordering') event.previousHash = read.events[0].hash
        raw
          .prepare('UPDATE journals SET envelope=? WHERE org_id=? AND sequence=3')
          .run(canonical(event), p.s.principal.orgId)
      }
      if (attack === 'coherent-truncation') {
        raw.exec(
          "DELETE FROM decisions WHERE org_id='SYN-A-ORG'; DELETE FROM receipts WHERE org_id='SYN-A-ORG' AND sequence=3; DELETE FROM journals WHERE org_id='SYN-A-ORG' AND sequence=3;",
        )
        const state = apply(
          genesis(p.s.seed),
          p.s.principal,
          proofOperations('A').operations[0],
        ).state
        raw
          .prepare('UPDATE heads SET sequence=2,hash=?,state=? WHERE org_id=?')
          .run(read.events[1].hash, canonical(state), p.s.principal.orgId)
        checkpoint = oldCp
        anchor = oldAnchor.anchor
      }
      if (attack === 'coherent-both') {
        const event: Event = structuredClone(read.events[2])
        if (event.payload.kind !== 'operation' || event.payload.operation.kind !== 'decision')
          throw new Error('fixture')
        event.payload.operation.rationale = 'Fictional coherent rewritten consequential decision'
        const predecessor = apply(
          genesis(p.s.seed),
          p.s.principal,
          proofOperations('A').operations[0],
        ).state
        const state = apply(predecessor, event.payload.principal, event.payload.operation).state
        event.stateDigest = digest(state)
        event.resultDigest = digest({ sequence: 3, stateDigest: event.stateDigest })
        event.hash = eventDigest(event)
        raw
          .prepare('UPDATE journals SET envelope=?,hash=? WHERE org_id=? AND sequence=3')
          .run(canonical(event), event.hash, p.s.principal.orgId)
        raw
          .prepare('UPDATE heads SET state=?,hash=? WHERE org_id=?')
          .run(canonical(state), event.hash, p.s.principal.orgId)
        raw
          .prepare('UPDATE receipts SET request_hash=?,result=? WHERE org_id=? AND sequence=3')
          .run(
            digest({ principal: event.payload.principal, operation: event.payload.operation }),
            canonical({ sequence: 3, hash: event.hash, stateDigest: event.stateDigest }),
            p.s.principal.orgId,
          )
        raw
          .prepare('UPDATE decisions SET record=? WHERE org_id=?')
          .run(canonical(state.decisions[0]), p.s.principal.orgId)
        checkpoint.headDigest = event.hash
        checkpoint.stateDigest = event.stateDigest
        anchor.journalHeadDigest = event.hash
        anchor.stateDigest = event.stateDigest
        anchor.checkpointDigest = digest(checkpoint)
      }
      if (attack === 'stale-anchor') {
        anchor = oldAnchor.anchor
        checkpoint = oldCp
      }
      raw.close()
      const damagedBytes = readFileSync(join(adversarialDirectory, copyName))
      writeFileSync(
        join(checkpointDirectory, `${id}-attack-${attack}.json`),
        canonical(checkpoint) + '\n',
        { flag: 'wx' },
      )
      const copy = open(copyName, { adversarialCopy: true })
      if (attack === 'coherent-both' || attack === 'coherent-truncation') {
        // These copies are internally consistent. Detection must depend on the separately held pin.
        expect(copy.read(p.s.principal).version).toBe(attack === 'coherent-both' ? 3 : 2)
      }
      let detection = ''
      try {
        verifyAnchor(copy, p.s.principal, checkpoint, anchor, pin)
      } catch (error) {
        detection = String(error)
      }
      expect(detection, attack).toMatch(/INTEGRITY_FAILED|STALE_ANCHOR/)
      copy.close()
      expect(readFileSync(join(adversarialDirectory, copyName))).toEqual(damagedBytes)
      const record = {
        attack,
        detection,
        copiedStore: copyName,
        checkpoint,
        offeredAnchor: anchor,
        trustedPinUnchanged: digest(pin),
      }
      evidence.integrity.push(record)
      writeFileSync(
        join(checkpointDirectory, `${id}-detection-${attack}.json`),
        canonical(record) + '\n',
        { flag: 'wx' },
      )
    }
    expect(readFileSync(join(storageDirectory, p.file))).toEqual(canonicalBytes)
    expect(readFileSync(join(checkpointDirectory, `${id}-current.json`))).toEqual(checkpointBytes)
    expect(trustedPin(`${id}-current`)).toEqual(pin)
    expect(verifyAnchor(open(p.file), p.s.principal, cp, current.anchor, pin).status).toBe(
      'ANCHORED_PREFIX_VERIFIED',
    )
    expect(digest({ a: { b: 1, c: 2 } })).toBe(digest({ a: { c: 2, b: 1 } }))
    expect(digest({ nested: 1 })).not.toBe(digest({ nested: 2 }))
    expect(() => canonical({ value: NaN })).toThrow('INVALID_INPUT')
  })
})
