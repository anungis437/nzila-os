/**
 * Persister tests — idempotency, dry-run, transaction rollback, reset
 * safety. Uses the in-memory adapter so tests are hermetic.
 */
import { describe, expect, it, vi } from 'vitest'

import { createInMemoryAdapter } from '../../src/db/adapter'
import { persistAppPlan, resetForOrgs } from '../../src/db/persister'

const SAFE_ORG = 'org-ue-staging-local-9999'

function plan(overrides: Partial<Parameters<typeof persistAppPlan>[1]> = {}) {
  return {
    app: 'union-eyes',
    orgId: SAFE_ORG,
    profile: 'demo-light',
    seed: 42,
    entities: [
      { entityType: 'members', rows: [{ id: 'member-1', name: 'A' }, { id: 'member-2', name: 'B' }] },
      { entityType: 'grievances', rows: [{ id: 'griev-1', subject: 'X' }] },
    ],
    ...overrides,
  }
}

describe('persistAppPlan', () => {
  it('writes one run row plus all artifact rows in a single transaction', async () => {
    const adapter = createInMemoryAdapter()
    const result = await persistAppPlan(adapter, plan(), { command: 'seed', dryRun: false })

    expect(result.status).toBe('ok')
    expect(result.totals).toEqual({ members: 2, grievances: 1 })

    const dump = adapter.dump!()
    expect(dump.runs).toHaveLength(1)
    expect(dump.artifacts).toHaveLength(3)
  })

  it('is idempotent across runs with the same plan (UPSERT, no duplicates)', async () => {
    const adapter = createInMemoryAdapter()
    await persistAppPlan(adapter, plan(), { command: 'seed', dryRun: false })
    await persistAppPlan(adapter, plan(), { command: 'seed', dryRun: false })

    const dump = adapter.dump!()
    // Two run rows (audit), still only 3 distinct artifacts.
    expect(dump.runs).toHaveLength(2)
    expect(dump.artifacts).toHaveLength(3)
  })

  it('records an audit row with status="dry-run" and writes NO artifacts when dryRun=true', async () => {
    const adapter = createInMemoryAdapter()
    const result = await persistAppPlan(adapter, plan(), { command: 'seed', dryRun: true })

    expect(result.status).toBe('dry-run')

    const dump = adapter.dump!()
    expect(dump.runs).toHaveLength(1)
    expect((dump.runs[0] as { status?: string }).status).toBe('dry-run')
    expect(dump.artifacts).toHaveLength(0)
  })

  it('rejects a non-staging org id immediately', async () => {
    const adapter = createInMemoryAdapter()
    await expect(
      persistAppPlan(adapter, plan({ orgId: 'org-real-tenant-1' }), {
        command: 'seed',
        dryRun: false,
      }),
    ).rejects.toThrow()
    expect(adapter.dump!().runs).toHaveLength(0)
  })

  it('rolls the artifact transaction back on failure and rethrows the error', async () => {
    const adapter = createInMemoryAdapter()
    // Wrap upsert to throw on the 2nd entity batch.
    const orig = adapter.withTransaction.bind(adapter)
    let calls = 0
    const wrapped: typeof adapter.withTransaction = async (fn) =>
      orig(async (tx) => {
        const upsert = tx.upsertArtifacts.bind(tx)
        tx.upsertArtifacts = async (rows) => {
          calls++
          if (calls === 2) throw new Error('synthetic upsert failure')
          return upsert(rows)
        }
        return fn(tx)
      })
    ;(adapter as { withTransaction: typeof wrapped }).withTransaction = wrapped

    await expect(
      persistAppPlan(adapter, plan(), { command: 'seed', dryRun: false }),
    ).rejects.toThrow(/synthetic upsert failure/)

    // Run row + all artifacts roll back together (one transaction). The
    // best-effort `finishRun` then no-ops because the run id no longer
    // exists. Net effect: adapter is untouched, error surfaces to caller.
    const dump = adapter.dump!()
    expect(dump.runs).toHaveLength(0)
    expect(dump.artifacts).toHaveLength(0)
  })
})

describe('resetForOrgs', () => {
  it('refuses any non-staging org id BEFORE touching the adapter', async () => {
    const adapter = createInMemoryAdapter()
    const spy = vi.spyOn(adapter, 'withTransaction')
    await expect(resetForOrgs(adapter, ['org-acme-real'])).rejects.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns counts grouped by (app, entity_type) after deletion', async () => {
    const adapter = createInMemoryAdapter()
    await persistAppPlan(adapter, plan(), { command: 'seed', dryRun: false })
    const counts = await resetForOrgs(adapter, [SAFE_ORG])
    expect(counts).toEqual({ 'union-eyes::members': 2, 'union-eyes::grievances': 1 })
    expect(adapter.dump!().artifacts).toHaveLength(0)
  })

  it('returns empty counts when given an empty list (no-op)', async () => {
    const adapter = createInMemoryAdapter()
    expect(await resetForOrgs(adapter, [])).toEqual({})
  })
})
