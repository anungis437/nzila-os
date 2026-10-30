import { describe, expect, it } from 'vitest'
import { InMemoryAtomicTrustLedgerStore, LEDGER_GENESIS_HASH } from './ledger-store'
import type { AtomicTrustLedgerStore, LedgerHead, TrustLedgerHeadWitness } from './ledger-store'
import { ToolTrustLedger, LedgerIntegrityError, TOOL_TRUST_LEDGER_ORG } from './ledger'

function persistentAdapter(): AtomicTrustLedgerStore {
  const memory = new InMemoryAtomicTrustLedgerStore()
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
})
