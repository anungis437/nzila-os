import { describe, expect, it } from 'vitest'
import { InMemoryAtomicTrustLedgerStore, LEDGER_GENESIS_HASH } from './ledger-store'
import type { AtomicTrustLedgerStore, LedgerHead, TrustLedgerHeadWitness } from './ledger-store'
import { ToolTrustLedger, LedgerIntegrityError, TOOL_TRUST_LEDGER_ORG } from './ledger'
import { pinned } from './fixtures'

function persistentAdapter(memory = new InMemoryAtomicTrustLedgerStore()): AtomicTrustLedgerStore {
  return {
    atomicContract: 'tool-trust-ledger-cas-v1',
    persistence: 'HOST_ATTESTED_PERSISTENT',
    readSnapshot: orgId => memory.readSnapshot(orgId),
    compareAndAppend: (orgId, head, entry) => memory.compareAndAppend(orgId, head, entry),
  }
}

describe('P0 persistent ledger independent high-watermark witness', () => {
  it('never trusts a persistent adapter without a separate witness', async () => {
    const ledger = new ToolTrustLedger(persistentAdapter())
    await expect(ledger.load()).rejects.toThrow('independent rollback witness')
  })

  it('a valid empty head is admissible ONLY when independently witnessed', async () => {
    const witness: TrustLedgerHeadWitness = {
      verifyCurrentHead: async (orgId: string, head: LedgerHead) =>
        orgId === TOOL_TRUST_LEDGER_ORG && head.revision === 0 &&
        head.headHash === LEDGER_GENESIS_HASH,
      sealCommittedHead: async () => false,
    }
    const ledger = new ToolTrustLedger(persistentAdapter(), { headWitness: witness })
    const registry = await ledger.load()
    expect(registry).toBeDefined()
  })

  it('a changed high-watermark denies even a self-consistent empty snapshot', async () => {
    const witness: TrustLedgerHeadWitness = {
      verifyCurrentHead: async (_orgId, head) => head.revision > 0,
      sealCommittedHead: async () => false,
    }
    const ledger = new ToolTrustLedger(persistentAdapter(), { headWitness: witness })
    await expect(ledger.load()).rejects.toThrow('TRUST_LEDGER_ROLLBACK_WITNESS_MISMATCH')
  })

  it('an unavailable witness cannot be interpreted as an empty or approved ledger', async () => {
    const witness: TrustLedgerHeadWitness = {
      verifyCurrentHead: async () => { throw new Error('unavailable') },
      sealCommittedHead: async () => true,
    }
    const ledger = new ToolTrustLedger(persistentAdapter(), { headWitness: witness })
    await expect(ledger.load()).rejects.toBeInstanceOf(LedgerIntegrityError)
  })

  it('advances an independently CAS-witnessed head and permits fresh-object replay', async () => {
    const store = persistentAdapter()
    let witnessed: LedgerHead = { revision: 0, headHash: LEDGER_GENESIS_HASH }
    const witness: TrustLedgerHeadWitness = {
      verifyCurrentHead: async (orgId, head) => orgId === TOOL_TRUST_LEDGER_ORG &&
        head.revision === witnessed.revision && head.headHash === witnessed.headHash,
      sealCommittedHead: async (orgId, previous, committed) => {
        if (orgId !== TOOL_TRUST_LEDGER_ORG || previous.revision !== witnessed.revision ||
            previous.headHash !== witnessed.headHash || committed.revision !== previous.revision + 1) return false
        witnessed = { ...committed }
        return true
      },
    }
    const options = {
      headWitness: witness,
      mutationAuthority: {
        authorize: async () => ({
          actorId: 'trusted-host', role: 'platform-governance-board',
          authorityRef: 'host:test-identity', permittedOperations: ['register' as const],
        }),
      },
    }
    await new ToolTrustLedger(store, options).register(pinned())
    expect(witnessed.revision).toBe(1)
    expect((await new ToolTrustLedger(store, options).load()).list()).toHaveLength(1)
    // An internally valid but rolled-back database must not be accepted.
    await expect(new ToolTrustLedger(persistentAdapter(), options).load())
      .rejects.toThrow('TRUST_LEDGER_ROLLBACK_WITNESS_MISMATCH')
  })

  it('does not acknowledge a durable append when independent witness sealing fails', async () => {
    const store = persistentAdapter()
    const witness: TrustLedgerHeadWitness = {
      verifyCurrentHead: async (_orgId, head) =>
        head.revision === 0 && head.headHash === LEDGER_GENESIS_HASH,
      sealCommittedHead: async () => false,
    }
    const ledger = new ToolTrustLedger(store, {
      headWitness: witness,
      mutationAuthority: {
        authorize: async () => ({
          actorId: 'trusted-host', role: 'platform-governance-board',
          authorityRef: 'host:test-identity', permittedOperations: ['register' as const],
        }),
      },
    })
    await expect(ledger.register(pinned())).rejects.toThrow('TRUST_LEDGER_WITNESS_SEAL_FAILED')
    expect((await store.readSnapshot(TOOL_TRUST_LEDGER_ORG)).revision).toBe(1)
    await expect(ledger.load()).rejects.toThrow('TRUST_LEDGER_ROLLBACK_WITNESS_MISMATCH')
  })
})
