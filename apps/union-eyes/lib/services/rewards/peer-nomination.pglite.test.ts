import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/pglite'
import type { SQL } from 'drizzle-orm'
import * as rewards from '@/db/schema/domains/infrastructure/rewards'
import { createRewardsBoundaryFixture } from '@/db/__tests__/rewards-boundary-testkit'
import { canonicalActionScope } from '@/actions/__tests__/fixtures/canonical-action-scope'

// The source service receives the actual restricted fixture connection below.
// No default network connection may be used by these component proofs.
vi.mock('@/db', () => ({ db: {} }))
import type { db as productionDb } from '@/db'
const actionPort = vi.hoisted(() => ({ executor: null as typeof productionDb | null }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (
    _scope: unknown,
    operation: (tx: typeof productionDb) => Promise<unknown>,
  ) => {
    if (!actionPort.executor) throw new Error('No actual fixture transaction')
    return operation(actionPort.executor)
  },
  withSystemContext: () => {
    throw new Error('Unexpected system authority')
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { createPeerNomination } from './award-service'
import {
  nominatePeer,
  listPeerRecognitionPrograms,
  listPeerRecognitionAwardTypes,
} from '@/actions/rewards-actions'

describe('pending peer text nomination on actual canonical reward storage', () => {
  let fixture: Awaited<ReturnType<typeof createRewardsBoundaryFixture>>
  let executor: typeof productionDb
  beforeEach(async () => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
    fixture = await createRewardsBoundaryFixture(undefined, { withAudit: true })
    const database = drizzle(fixture.db, { schema: rewards })
    // Match the production postgres-js row-array port, while all SQL still runs
    // in PGlite under the fixture's actual session_user, role and bearer.
    const adapter = Object.assign(Object.create(database), {
      execute: async (statement: SQL) => (await database.execute(statement)).rows,
      transaction: async <T>(operation: (tx: typeof productionDb) => Promise<T>) => {
        await fixture.db.exec('SAVEPOINT peer_nomination_service')
        try {
          const result = await operation(executor)
          await fixture.db.exec('RELEASE SAVEPOINT peer_nomination_service')
          return result
        } catch (error) {
          await fixture.db.exec(
            'ROLLBACK TO SAVEPOINT peer_nomination_service; RELEASE SAVEPOINT peer_nomination_service',
          )
          throw error
        }
      },
    })
    executor = adapter as unknown as typeof productionDb
    actionPort.executor = executor
  })
  afterEach(async () => {
    expect(await fixture.preserved()).toEqual(fixture.history)
    await fixture.db.close()
    delete process.env.UE_CANONICAL_BOOTSTRAP_V2
  })
  const nominate = (overrides: Partial<Parameters<typeof createPeerNomination>[0]> = {}) =>
    fixture.runtime(() =>
      createPeerNomination({
        orgId: fixture.org,
        awardTypeId: fixture.peerType,
        nominatorUserId: fixture.actor,
        recipientUserId: fixture.recipient,
        reason: 'Thank you for helping a colleague',
        executor,
        ...overrides,
      }),
    )

  it('stores only a pending text nomination and its real atomic audit, without financial projections', async () => {
    const result = await nominate()
    expect(result).toMatchObject({
      issuerUserId: fixture.actor,
      recipientUserId: fixture.recipient,
      status: 'pending',
    })
    expect(Object.keys(result).sort()).toEqual(
      [
        'id',
        'orgId',
        'programId',
        'awardTypeId',
        'recipientUserId',
        'issuerUserId',
        'reason',
        'status',
        'createdAt',
        'updatedAt',
      ].sort(),
    )
    expect(result.createdAt).toBeInstanceOf(Date)
    const rows = await fixture.db.query(
      'SELECT status,approved_by_user_id,approved_at,issued_at,metadata_json FROM public.recognition_awards WHERE id=$1',
      [result.id],
    )
    expect(rows.rows).toEqual([
      {
        status: 'pending',
        approved_by_user_id: null,
        approved_at: null,
        issued_at: null,
        metadata_json: { nomination: true },
      },
    ])
    expect(
      (
        await fixture.db.query(
          'SELECT action,resource_id,user_id,content_hash FROM public.audit_logs WHERE resource_id=$1',
          [result.id],
        )
      ).rows,
    ).toEqual([
      expect.objectContaining({
        action: 'rewards.award.nominate',
        resource_id: result.id,
        user_id: fixture.actor,
        content_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    ])
  })
  it('denies an actor substitution before a nomination or audit', async () => {
    await expect(nominate({ nominatorUserId: 'foreign-recipient' })).rejects.toThrow(
      'Recognition actor changed',
    )
    expect(
      (await fixture.db.query('SELECT count(*)::int AS n FROM public.audit_logs')).rows,
    ).toEqual([{ n: 0 }])
  })
  it('denies foreign recipients, non-peer types and self-nomination', async () => {
    await expect(nominate({ recipientUserId: 'foreign-recipient' })).rejects.toThrow(
      'current members',
    )
    await expect(nominate({ awardTypeId: fixture.adminType })).rejects.toThrow(
      'Award type not found',
    )
    await expect(nominate({ recipientUserId: fixture.actor })).rejects.toThrow(
      'cannot nominate yourself',
    )
  })
  it('rereads current membership and refuses a revoked recipient', async () => {
    await fixture.db.query(
      'UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1',
      [fixture.recipient],
    )
    await expect(nominate()).rejects.toThrow('current members')
  })
  it('preserves the existing duplicate-pending refusal', async () => {
    await nominate()
    await expect(nominate()).rejects.toThrow('already nominated')
    expect(
      (
        await fixture.db.query(
          'SELECT count(*)::int AS n FROM public.recognition_awards WHERE issuer_user_id=$1',
          [fixture.actor],
        )
      ).rows,
    ).toEqual([{ n: 1 }])
  })
  it('rolls the nomination back when its mandatory audit cannot be appended', async () => {
    await fixture.db
      .exec(`CREATE FUNCTION public.peer_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic mandatory audit outage'; END $$;
      CREATE TRIGGER peer_audit_failure BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.peer_audit_failure()`)
    await expect(nominate()).rejects.toMatchObject({
      cause: expect.objectContaining({ message: 'synthetic mandatory audit outage' }),
    })
    expect(
      (
        await fixture.db.query(
          'SELECT count(*)::int AS n FROM public.recognition_awards WHERE issuer_user_id=$1',
          [fixture.actor],
        )
      ).rows,
    ).toEqual([{ n: 0 }])
  })
  it('runs the actual server action through its canonical callback and actual restricted transaction', async () => {
    const result = await fixture.runtime(() =>
      canonicalActionScope(
        () =>
          nominatePeer({
            awardTypeId: fixture.peerType,
            recipientUserId: fixture.recipient,
            reason: 'A thoughtful text nomination',
          }),
        { userId: fixture.actor, organizationId: fixture.org },
      ),
    )
    expect(result).toMatchObject({
      success: true,
      data: { id: expect.any(String), status: 'pending' },
    })
    expect(
      (await fixture.db.query('SELECT count(*)::int AS n FROM public.audit_logs')).rows,
    ).toEqual([{ n: 1 }])
  })
  it('keeps retained credit configuration out of the actual member action selectors', async () => {
    const result = await fixture.runtime(() =>
      canonicalActionScope(
        async () => ({
          programs: await listPeerRecognitionPrograms(),
          types: await listPeerRecognitionAwardTypes(fixture.program),
        }),
        { userId: fixture.actor, organizationId: fixture.org },
      ),
    )
    expect(result.programs).toMatchObject({ success: true, data: [{ id: fixture.program }] })
    expect(result.types).toMatchObject({
      success: true,
      data: [{ id: fixture.peerType, kind: 'peer' }],
    })
    const serialized = JSON.stringify(result)
    for (const field of [
      'currency',
      'defaultCreditAmount',
      'requiresApproval',
      'rulesJson',
      'retainedFinancialRules',
    ])
      expect(serialized).not.toContain(field)
  })
})
