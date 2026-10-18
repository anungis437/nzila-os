import { createHash, randomUUID } from 'node:crypto'
import { computeAuditHash, InMemoryAuditStore, type AuditEntry } from '@nzila/audit'
import { describe, expect, it, vi } from 'vitest'

import {
  LedgerIntegrityError,
  LedgerMutationAuthorizationError,
  ToolTrustLedger,
  TOOL_TRUST_LEDGER_ORG,
  type LedgerMutationAuthority,
  type LedgerOptions,
} from './ledger'
import {
  DenyOnlyAtomicTrustLedgerStore,
  InMemoryAtomicTrustLedgerStore,
  LedgerConflictError,
  LedgerDuplicateError,
  LedgerStoreUnavailableError,
  type AtomicTrustLedgerStore,
  type LedgerSnapshot,
} from './ledger-store'
import { BASE_EVIDENCE, evidence, evidenceRefsFor, grant, KEY, NOW_DATE, pinned, snapshot } from './fixtures'
import { StaticGovernanceDecisionVerifier } from './testing'
import { canonicalJson } from './authority'

const authority: LedgerMutationAuthority = {
  async authorize() {
    return {
      actorId: 'approver-a',
      role: 'platform-governance-board',
      authorityRef: 'host:ledger-policy-v1',
      permittedOperations: ['register', 'decide', 'observe', 'reaffirm'],
    }
  },
}

function fixture(store: AtomicTrustLedgerStore = new InMemoryAtomicTrustLedgerStore(), overrides: LedgerOptions = {}) {
  const verifier = new StaticGovernanceDecisionVerifier()
  verifier.add(snapshot({ decisionRef: 'EVAL-1', outcome: 'EVALUATE' }))
  const options: LedgerOptions = {
    now: () => NOW_DATE,
    mutationAuthority: authority,
    governanceVerifier: verifier,
    ...overrides,
  }
  return { store, verifier, options, ledger: new ToolTrustLedger(store, options) }
}

const evaluating = {
  toolKey: KEY, to: 'EVALUATING' as const, decisionRef: 'EVAL-1', rationale: 'review', evidence: [],
}

function adapted(
  store: AtomicTrustLedgerStore,
  read: (snapshot: LedgerSnapshot) => LedgerSnapshot,
): AtomicTrustLedgerStore {
  return {
    atomicContract: 'tool-trust-ledger-cas-v1',
    persistence: 'NON_DURABLE_CONTRACT_ONLY',
    readSnapshot: async (org) => read(await store.readSnapshot(org)),
    compareAndAppend: (org, head, entry) => store.compareAndAppend(org, head, entry),
  }
}

function rehash(entries: readonly AuditEntry[]): void {
  let prev = '0'.repeat(64)
  for (const entry of entries) {
    entry.prevHash = prev
    entry.hash = computeAuditHash(prev, {
      id: entry.id, timestamp: entry.timestamp, actorId: entry.actorId, orgId: entry.orgId,
      action: entry.action, resource: entry.resource, resourceId: entry.resourceId, payload: entry.payload,
    })
    prev = entry.hash
  }
}

describe('trust ledger atomic storage contract (NON-DURABLE, BROKER HOLD)', () => {
  it('denies the production default and legacy non-atomic stores', async () => {
    await expect(new ToolTrustLedger().load()).rejects.toThrow(LedgerStoreUnavailableError)
    await expect(new DenyOnlyAtomicTrustLedgerStore().compareAndAppend(
      TOOL_TRUST_LEDGER_ORG, { revision: 0, headHash: '0'.repeat(64) }, {} as AuditEntry,
    )).rejects.toThrow(LedgerStoreUnavailableError)
    const legacy = new InMemoryAuditStore()
    const ledger = new ToolTrustLedger(legacy, { mutationAuthority: authority })
    await expect(ledger.load()).rejects.toThrow(/atomic snapshot/)
    await expect(ledger.register(pinned())).rejects.toThrow(LedgerStoreUnavailableError)
    expect(legacy.getAll()).toHaveLength(0)
  })

  it('replays a new ledger object over the same adapter, but never claims process durability', async () => {
    const f = fixture()
    expect(f.store.persistence).toBe('NON_DURABLE_CONTRACT_ONLY')
    await f.ledger.register(pinned())
    await f.ledger.decide(evaluating, f.verifier)
    const replay = await new ToolTrustLedger(f.store, f.options).load()
    expect(replay.get(KEY)?.status).toBe('EVALUATING')
    expect((await f.store.readSnapshot(TOOL_TRUST_LEDGER_ORG)).revision).toBe(2)
    expect((await new ToolTrustLedger(new InMemoryAtomicTrustLedgerStore()).load()).list()).toHaveLength(0)
  })

  it('records the actual host actor and role, not a fabricated system actor', async () => {
    const f = fixture()
    await f.ledger.register(pinned())
    const entry = (await f.store.readSnapshot(TOOL_TRUST_LEDGER_ORG)).entries[0]
    expect(entry.actorId).toBe('approver-a')
    expect(entry.payload.mutation).toEqual({
      actorId: entry.actorId, role: 'platform-governance-board',
      authorityRef: 'host:ledger-policy-v1', operation: 'register',
    })
  })

  it('replays approval, drift suspension, and reaffirmation across ledger reconstruction', async () => {
    const f = fixture()
    await f.ledger.register(pinned())
    await f.ledger.decide(evaluating)
    f.verifier.add(snapshot({ decisionRef: 'APPROVE-1', evidenceRefs: evidenceRefsFor(BASE_EVIDENCE) }))
    await f.ledger.decide({
      toolKey: KEY, to: 'APPROVED', decisionRef: 'APPROVE-1', rationale: 'approved',
      evidence: evidence(BASE_EVIDENCE), grant,
    })
    const observed = pinned({ identity: { ...pinned().identity, digest: `sha256:${'b'.repeat(64)}` } })
    await new ToolTrustLedger(f.store, f.options).observeUpstream(KEY, observed)
    expect((await f.ledger.load()).get(KEY)?.suspension).not.toBeNull()
    f.verifier.add(snapshot({
      decisionRef: 'REAFFIRM-1', subjectDigest: observed.identity.digest,
      evidenceRefs: evidenceRefsFor(BASE_EVIDENCE),
    }))
    await new ToolTrustLedger(f.store, f.options).reaffirm({
      toolKey: KEY, observed, decisionRef: 'REAFFIRM-1', rationale: 'new digest reviewed',
      evidence: evidence(BASE_EVIDENCE), grant,
    })
    const record = (await new ToolTrustLedger(f.store, f.options).load()).get(KEY)!
    expect(record.status).toBe('APPROVED')
    expect(record.suspension).toBeNull()
    expect(record.descriptor.identity.digest).toBe(observed.identity.digest)
    expect(record.decisions).toHaveLength(3)
    expect(record.grant?.allowedFilesystemRoots).toEqual(grant.allowedFilesystemRoots)
    expect(record.grant?.allowedEnv).toEqual(grant.allowedEnv)
    expect(record.grant?.resourceLimits).toEqual(grant.resourceLimits)
  })

  it('reads complete snapshots beyond the former 500-event page boundary', async () => {
    const f = fixture()
    await f.ledger.register(pinned())
    const entries = [...(await f.store.readSnapshot(TOOL_TRUST_LEDGER_ORG)).entries]
    // Build a read-contract fixture directly: repeatedly replaying growing drift
    // histories during fixture setup is cubic work unrelated to pagination.
    for (let seq = 2; seq <= 502; seq++) {
      const previous = entries.at(-1)!
      const body = {
        type: 'TOOL_REGISTERED',
        descriptor: pinned({ identity: { ...pinned().identity, name: `internal/page-${seq}` } }),
      }
      const mutation = previous.payload.mutation
      const prevEventHash = previous.payload.eventHash
      const eventHash = createHash('sha256')
        .update(canonicalJson({ seq, prevEventHash, body, mutation })).digest('hex')
      const hashable = {
        id: randomUUID(), timestamp: previous.timestamp, actorId: previous.actorId,
        orgId: TOOL_TRUST_LEDGER_ORG, action: previous.action, resource: previous.resource,
        resourceId: `internal/page-${seq}@2.1.0`,
        payload: { seq, prevEventHash, eventHash, body, mutation },
      }
      entries.push({
        ...hashable, prevHash: previous.hash, hash: computeAuditHash(previous.hash, hashable), hashVersion: 2,
      })
    }
    const fullSnapshot = { entries, revision: entries.length, headHash: entries.at(-1)!.hash }
    const replay = await new ToolTrustLedger(adapted(f.store, () => fullSnapshot), f.options).load()
    expect(replay.list()).toHaveLength(502)
    expect(replay.get('internal/page-502@2.1.0')?.status).toBe('DISCOVERED')
  })

  it('competing writers from one snapshot commit exactly one event; the loser must re-evaluate', async () => {
    const f = fixture()
    const other = new ToolTrustLedger(f.store, f.options)
    const second = pinned({ identity: { ...pinned().identity, name: 'internal/second' } })
    const results = await Promise.allSettled([f.ledger.register(pinned()), other.register(second)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((r) => r.status === 'rejected')
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(LedgerConflictError)
    expect((await f.ledger.load()).list()).toHaveLength(1)
    const missing = (await f.ledger.load()).get(KEY) ? second : pinned()
    await other.register(missing)
    expect((await f.ledger.load()).list()).toHaveLength(2)
  })

  it('binds expected revision to state evaluated before asynchronous verification', async () => {
    const f = fixture()
    await f.ledger.register(pinned())
    const original = f.verifier.verify.bind(f.verifier)
    let release!: () => void
    let entered!: () => void
    const ready = new Promise<void>((resolve) => { entered = resolve })
    const barrier = new Promise<void>((resolve) => { release = resolve })
    f.verifier.verify = async (...args) => {
      entered()
      await barrier
      return original(...args)
    }
    const pending = f.ledger.decide(evaluating)
    await ready
    await new ToolTrustLedger(f.store, f.options).observeUpstream(KEY, pinned())
    release()
    await expect(pending).rejects.toThrow(LedgerConflictError)
    expect((await f.ledger.load()).get(KEY)?.status).toBe('DISCOVERED')
    expect((await f.store.readSnapshot(TOOL_TRUST_LEDGER_ORG)).revision).toBe(2)
  })

  it('snapshots and inserted values are detached from caller mutation', async () => {
    const f = fixture()
    await f.ledger.register(pinned())
    const snapshot = await f.store.readSnapshot(TOOL_TRUST_LEDGER_ORG)
    snapshot.entries[0].actorId = 'edited'
    expect((await f.ledger.load()).get(KEY)?.status).toBe('DISCOVERED')
  })

  it('rejects retry duplicates without appending and rejects stale expected heads', async () => {
    const f = fixture()
    await f.ledger.register(pinned())
    await expect(f.ledger.register(pinned())).rejects.toThrow(/already registered/)
    const s = await f.store.readSnapshot(TOOL_TRUST_LEDGER_ORG)
    await expect(f.store.compareAndAppend(TOOL_TRUST_LEDGER_ORG, s, s.entries[0])).rejects.toThrow(LedgerDuplicateError)
    await expect(f.store.compareAndAppend(TOOL_TRUST_LEDGER_ORG, {
      revision: 0, headHash: '0'.repeat(64),
    }, s.entries[0])).rejects.toThrow(LedgerConflictError)
    await expect(f.store.compareAndAppend(TOOL_TRUST_LEDGER_ORG, {
      revision: s.revision, headHash: 'f'.repeat(64),
    }, s.entries[0])).rejects.toThrow(LedgerConflictError)
    expect((await f.store.readSnapshot(TOOL_TRUST_LEDGER_ORG)).revision).toBe(1)
  })

  it('rejects duplicate governance decisions, including retries after ledger reconstruction', async () => {
    const f = fixture()
    await f.ledger.register(pinned())
    await f.ledger.decide(evaluating)
    await expect(new ToolTrustLedger(f.store, f.options).decide(evaluating)).rejects.toThrow(LedgerDuplicateError)
    expect((await f.store.readSnapshot(TOOL_TRUST_LEDGER_ORG)).revision).toBe(2)
  })

  it('propagates read and audit commit failures without returning mutated state', async () => {
    const f = fixture()
    const write = vi.spyOn(f.store, 'compareAndAppend').mockRejectedValueOnce(new Error('audit unavailable'))
    await expect(f.ledger.register(pinned())).rejects.toThrow('audit unavailable')
    expect((await f.ledger.load()).list()).toHaveLength(0)
    write.mockRestore()
    await f.ledger.register(pinned())
    vi.spyOn(f.store, 'readSnapshot').mockRejectedValueOnce(new Error('snapshot unavailable'))
    await expect(f.ledger.observeUpstream(KEY, null)).rejects.toThrow('snapshot unavailable')
    expect((await f.store.readSnapshot(TOOL_TRUST_LEDGER_ORG)).revision).toBe(1)
  })

  it('does not duplicate registration after an ambiguous post-commit audit error', async () => {
    const f = fixture()
    const append = f.store.compareAndAppend.bind(f.store)
    vi.spyOn(f.store, 'compareAndAppend').mockImplementationOnce(async (...args) => {
      await append(...args)
      throw new Error('connection lost after commit')
    })
    await expect(f.ledger.register(pinned())).rejects.toThrow('connection lost after commit')
    await expect(f.ledger.register(pinned())).rejects.toThrow(/already registered/)
    expect((await f.store.readSnapshot(TOOL_TRUST_LEDGER_ORG)).revision).toBe(1)
    expect((await f.ledger.load()).list()).toHaveLength(1)
  })

  it('rejects an invalid commit receipt instead of claiming success', async () => {
    const f = fixture()
    vi.spyOn(f.store, 'compareAndAppend').mockResolvedValue({ revision: 10, headHash: 'f'.repeat(64) })
    await expect(f.ledger.register(pinned())).rejects.toThrow(/commit receipt/)
  })

  it.each([
    ['truncated pagination', (s: LedgerSnapshot) => ({ ...s, entries: s.entries.slice(0, 1) })],
    ['wrong head', (s: LedgerSnapshot) => ({ ...s, headHash: 'f'.repeat(64) })],
    ['fractional revision', (s: LedgerSnapshot) => ({ ...s, revision: 1.5 })],
    ['duplicate entries', (s: LedgerSnapshot) => ({
      ...s, revision: 3, entries: [s.entries[0], s.entries[0], s.entries[1]],
    })],
    ['gap', (s: LedgerSnapshot) => ({ ...s, revision: 1, entries: s.entries.slice(1) })],
    ['fork/reorder', (s: LedgerSnapshot) => ({
      ...s, headHash: s.entries[0].hash, entries: [...s.entries].reverse(),
    })],
    ['cross-stream entry', (s: LedgerSnapshot) => {
      s.entries[0].orgId = 'different'
      return s
    }],
    ['body tamper', (s: LedgerSnapshot) => {
      s.entries[0].payload.body = { type: 'TOOL_REGISTERED', descriptor: pinned({ claimedCapabilities: ['evil'] }) }
      return s
    }],
    ['malformed payload', (s: LedgerSnapshot) => {
      s.entries[0].payload = {}
      rehash(s.entries)
      return { ...s, headHash: s.entries.at(-1)!.hash }
    }],
    ['nested tamper with repaired audit envelope', (s: LedgerSnapshot) => {
      const body = s.entries[0].payload.body as { descriptor: { claimedCapabilities: string[] } }
      body.descriptor.claimedCapabilities = ['evil']
      rehash(s.entries)
      return { ...s, headHash: s.entries.at(-1)!.hash }
    }],
    ['mutation provenance tamper', (s: LedgerSnapshot) => {
      s.entries[0].actorId = 'forged'
      rehash(s.entries)
      return { ...s, headHash: s.entries.at(-1)!.hash }
    }],
  ])('rejects %s snapshots before replay or mutation', async (_label, corrupt) => {
    const f = fixture()
    await f.ledger.register(pinned())
    await f.ledger.decide(evaluating)
    const ledger = new ToolTrustLedger(adapted(f.store, corrupt), f.options)
    await expect(ledger.load()).rejects.toThrow(LedgerIntegrityError)
    await expect(ledger.observeUpstream(KEY, null)).rejects.toThrow(LedgerIntegrityError)
    expect((await f.store.readSnapshot(TOOL_TRUST_LEDGER_ORG)).revision).toBe(2)
  })

  it('rejects legacy partial audit hashing instead of treating it as full integrity', async () => {
    const f = fixture()
    await f.ledger.register(pinned())
    const ledger = new ToolTrustLedger(adapted(f.store, (s) => {
      const entry = s.entries[0]
      entry.hashVersion = 1
      entry.hash = computeAuditHash(entry.prevHash, {
        id: entry.id, timestamp: entry.timestamp, actorId: entry.actorId, orgId: entry.orgId,
        action: entry.action, resource: entry.resource, resourceId: entry.resourceId, payload: entry.payload,
      }, 1)
      return { ...s, headHash: entry.hash }
    }), f.options)
    await expect(ledger.load()).rejects.toThrow(/Legacy/)
  })
})

describe('trust ledger mutation authorization host boundary', () => {
  it('denies all four mutations by default even on an atomic store', async () => {
    const f = fixture()
    await f.ledger.register(pinned())
    const denied = new ToolTrustLedger(f.store)
    await expect(denied.register(pinned())).rejects.toThrow(LedgerMutationAuthorizationError)
    await expect(denied.decide(evaluating, f.verifier)).rejects.toThrow(LedgerMutationAuthorizationError)
    await expect(denied.observeUpstream(KEY, null)).rejects.toThrow(LedgerMutationAuthorizationError)
    await expect(denied.reaffirm({ toolKey: KEY } as never, f.verifier)).rejects.toThrow(LedgerMutationAuthorizationError)
    expect((await f.store.readSnapshot(TOOL_TRUST_LEDGER_ORG)).revision).toBe(1)
  })

  it.each([
    null,
    { actorId: '', role: 'board', authorityRef: 'ref', permittedOperations: ['register'] },
    { actorId: 'actor', role: '', authorityRef: 'ref', permittedOperations: ['register'] },
    { actorId: 'actor', role: 'board', authorityRef: '', permittedOperations: ['register'] },
    { actorId: 'actor', role: 'board', authorityRef: 'ref', permittedOperations: [] },
  ])('rejects missing or incomplete host authorization %j', async (actor) => {
    const f = fixture(undefined, {
      mutationAuthority: { authorize: async () => actor as Awaited<ReturnType<LedgerMutationAuthority['authorize']>> },
    })
    await expect(f.ledger.register(pinned())).rejects.toThrow(LedgerMutationAuthorizationError)
    expect((await f.ledger.load()).list()).toHaveLength(0)
  })

  it('rejects caller-supplied verifier substitution and missing host verifier', async () => {
    const f = fixture()
    await f.ledger.register(pinned())
    const attacker = new StaticGovernanceDecisionVerifier()
    attacker.add(snapshot({ decisionRef: 'EVAL-1', outcome: 'EVALUATE' }))
    await expect(f.ledger.decide(evaluating, attacker)).rejects.toThrow(/trusted host/)
    const noVerifier = new ToolTrustLedger(f.store, { mutationAuthority: authority })
    await expect(noVerifier.decide(evaluating, f.verifier)).rejects.toThrow(/trusted host/)
    expect((await f.store.readSnapshot(TOOL_TRUST_LEDGER_ORG)).revision).toBe(1)
  })

  it('does not confuse governance approval with permission for the caller role', async () => {
    const f = fixture(undefined, {
      mutationAuthority: { authorize: async () => ({ ...(await authority.authorize({ operation: 'decide', resourceId: KEY }))!, role: 'observer' }) },
    })
    await f.ledger.register(pinned())
    await expect(f.ledger.decide(evaluating)).rejects.toThrow(/role does not match/)
    expect((await f.store.readSnapshot(TOOL_TRUST_LEDGER_ORG)).revision).toBe(1)
  })

  it('binds the authenticated actor to the actor on the verified governance decision', async () => {
    const f = fixture(undefined, {
      mutationAuthority: { authorize: async () => ({
        ...(await authority.authorize({ operation: 'decide', resourceId: KEY }))!, actorId: 'other-board-member',
      }) },
    })
    await f.ledger.register(pinned())
    await expect(f.ledger.decide(evaluating)).rejects.toThrow(/actor does not match/)
    expect((await f.store.readSnapshot(TOOL_TRUST_LEDGER_ORG)).revision).toBe(1)
  })

  it('host resolver errors fail closed and request fields cannot replace host authority', async () => {
    const f = fixture(undefined, { mutationAuthority: { authorize: async () => { throw new Error('auth offline') } } })
    await expect(f.ledger.register(pinned())).rejects.toThrow('auth offline')
    const denied = new ToolTrustLedger(f.store)
    await expect(denied.decide({ ...evaluating, mutationAuthority: authority, actorId: 'admin' } as never))
      .rejects.toThrow(LedgerMutationAuthorizationError)
    await expect(denied.reaffirm({
      ...evaluating, observed: pinned(), mutationAuthority: authority, actorId: 'admin',
    } as never)).rejects.toThrow(LedgerMutationAuthorizationError)
    expect((await f.ledger.load()).list()).toHaveLength(0)
  })
})
