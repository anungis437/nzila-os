/** Current source reward journey on an owned disposable combined PG15/16 clone.
 * Real auth gateway/session/binder, restricted action SQL and canonical audit.
 * No provider, institution adoption, browser or deployment qualification claim. */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { canonicalMembershipRole } from '@/lib/auth/canonical-membership-role'
import {
  currentCanonicalRequest,
  withCanonicalRequestScope,
} from '@/lib/auth/canonical-request-scope'
import { withNativeCanonicalActor } from '@/scripts/runtime/native-canonical-fixture'
import { insertMember, insertOrganization } from './page-reads-seed'
import { savepointHarness, RUNTIME_ROLE } from './native-savepoint-harness'
vi.mock('@/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
vi.mock('@/db/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => {
  const { savepointHarness, RUNTIME_ROLE, SYSTEM_ROLE } = await import('./native-savepoint-harness')
  const { currentCanonicalRequest } = await import('@/lib/auth/canonical-request-scope')
  return {
    withRLSContext: <T>(
      scope: { organizationId: string },
      operation: (tx: unknown) => Promise<T>,
    ) => {
      const current = currentCanonicalRequest({ organizationId: scope.organizationId })
      if (!current) throw new Error('Actual canonical native request required')
      return savepointHarness.context(
        RUNTIME_ROLE,
        scope.organizationId,
        current.binding.userId,
        operation,
      )
    },
    withSystemContext: <T>(operation: (tx: unknown) => Promise<T>) =>
      savepointHarness.context(SYSTEM_ROLE, null, null, operation),
  }
})
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
const URL = process.env.UE_AUTHORITY_COMBINED_URL
const actions = URL ? await import('@/actions/rewards-actions') : null
const pageReads = URL ? await import('@/lib/rewards/page-reads') : null

describe.skipIf(!URL)('current canonical rewards actions on owned native source', () => {
  let operator: pg.Client
  const org = randomUUID(),
    foreignOrg = randomUUID(),
    program = randomUUID(),
    peerType = randomUUID(),
    failedType = randomUUID()
  const actor = `peer-native-${randomUUID()}`,
    recipient = `recipient-native-${randomUUID()}`,
    foreign = `foreign-native-${randomUUID()}`
  const clockTag = randomUUID().slice(0, 8)
  const trigger = `peer_audit_failure_${clockTag}`
  const originalMode = process.env.UE_CANONICAL_BOOTSTRAP_V2
  const asActor = <T>(operation: () => Promise<T>) =>
    withNativeCanonicalActor(actor, org, (binding) =>
      withCanonicalRequestScope(
        binding,
        {
          userId: binding.userId,
          organizationId: binding.organizationId,
          role: canonicalMembershipRole(binding.role, false),
          email: `${actor}@example.invalid`,
          firstName: null,
          lastName: null,
          isSystemAdmin: false,
        },
        operation,
      ),
    )
  const count = async (sql: string, params: unknown[] = []) =>
    Number((await operator.query(sql, params)).rows[0].n)
  beforeAll(async () => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
    operator = await savepointHarness.start(URL!)
    await insertOrganization(operator, clockTag, { id: org })
    await insertOrganization(operator, clockTag, { id: foreignOrg })
    for (const [userId, organizationId] of [
      [actor, org],
      [recipient, org],
      [foreign, foreignOrg],
    ]) {
      await operator.query(
        `INSERT INTO user_management.users(user_id,email,is_active,lifecycle_state,is_system_admin)
        VALUES($1,$2,true,'active',false)`,
        [userId, `${userId}@example.invalid`],
      )
      await operator.query(
        "INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES($1,$2,'member',true)",
        [userId, organizationId],
      )
      await insertMember(operator, organizationId, {
        userId,
        name: userId === recipient ? 'Native colleague' : userId,
      })
    }
    await operator.query(
      `INSERT INTO public.recognition_programs(id,org_id,name,description,status,currency,created_at,updated_at)
      VALUES($1,$2,'Synthetic peer text','No credit authority','active','CAD',now(),now())`,
      [program, org],
    )
    for (const id of [peerType, failedType])
      await operator.query(
        `INSERT INTO public.recognition_award_types
      (id,org_id,program_id,name,kind,default_credit_amount,requires_approval,created_at,updated_at)
      VALUES($1,$2,$3,'Synthetic text category','peer',500,true,now(),now())`,
        [id, org, program],
      )
  })
  afterAll(async () => {
    await savepointHarness.stop()
    await operator?.end()
    if (originalMode === undefined) delete process.env.UE_CANONICAL_BOOTSTRAP_V2
    else process.env.UE_CANONICAL_BOOTSTRAP_V2 = originalMode
    // The central owned-clone harness removes the clone and its exact logins.
    // Immutable business/history rows are never deleted to clean a test.
  })
  it('uses the actual restricted LOGIN/session principal, never an operator action connection', async () => {
    await asActor(() =>
      savepointHarness.context(RUNTIME_ROLE, org, actor, async (tx) => {
        expect(currentCanonicalRequest()?.binding.userId).toBe(actor)
        const result = await tx.execute(
          (await import('drizzle-orm'))
            .sql`SELECT current_user,session_user,rolsuper,rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user`,
        )
        const rows = Array.from(result as Iterable<Record<string, unknown>>)
        expect(rows).toEqual([
          expect.objectContaining({
            current_user: RUNTIME_ROLE,
            rolsuper: false,
            rolbypassrls: false,
          }),
        ])
        expect(rows[0].session_user).toMatch(/^ue_native_[a-z0-9_]+_runtime$/)
      }),
    )
  })
  it('preserves safe program/type selectors and the supported pending text nomination with real audit', async () => {
    const result = await asActor(async () => ({
      programs: await actions!.listPeerRecognitionPrograms(),
      types: await actions!.listPeerRecognitionAwardTypes(program),
      nomination: await actions!.nominatePeer({
        awardTypeId: peerType,
        recipientUserId: recipient,
        reason: 'Thank you for helping our colleague',
      }),
    }))
    expect(result.programs).toMatchObject({
      success: true,
      data: [expect.objectContaining({ id: program })],
    })
    expect(result.types).toMatchObject({
      success: true,
      data: expect.arrayContaining([expect.objectContaining({ id: peerType })]),
    })
    expect(result.nomination).toMatchObject({
      success: true,
      data: { id: expect.any(String), status: 'pending' },
    })
    for (const field of ['defaultCreditAmount', 'requiresApproval', 'currency', 'rulesJson'])
      expect(JSON.stringify(result)).not.toContain(field)
    expect(
      await count(
        "SELECT count(*) AS n FROM public.audit_logs WHERE organization_id=$1 AND user_id=$2 AND action='rewards.award.nominate'",
        [org, actor],
      ),
    ).toBe(1)
    expect(
      await count('SELECT count(*) AS n FROM public.reward_wallet_ledger WHERE org_id=$1', [org]),
    ).toBe(0)
  })
  it('denies duplicate and foreign-recipient requests without creating another nomination', async () => {
    expect(
      await asActor(() =>
        actions!.nominatePeer({
          awardTypeId: peerType,
          recipientUserId: recipient,
          reason: 'Duplicate request',
        }),
      ),
    ).toMatchObject({ success: false })
    expect(
      await asActor(() =>
        actions!.nominatePeer({
          awardTypeId: failedType,
          recipientUserId: foreign,
          reason: 'Foreign request',
        }),
      ),
    ).toMatchObject({ success: false })
    expect(
      await count('SELECT count(*) AS n FROM public.recognition_awards WHERE org_id=$1', [org]),
    ).toBe(1)
  })
  it('rolls a supported nomination back if the actual mandatory audit fails', async () => {
    await operator.query(
      `CREATE FUNCTION public.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit outage'; END $$`,
    )
    await operator.query(
      `CREATE TRIGGER ${trigger} BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.${trigger}()`,
    )
    try {
      expect(
        await asActor(() =>
          actions!.nominatePeer({
            awardTypeId: failedType,
            recipientUserId: recipient,
            reason: 'Must roll back on audit failure',
          }),
        ),
      ).toMatchObject({ success: false })
      expect(
        await count('SELECT count(*) AS n FROM public.recognition_awards WHERE award_type_id=$1', [
          failedType,
        ]),
      ).toBe(0)
    } finally {
      await operator.query(`DROP TRIGGER ${trigger} ON public.audit_logs`)
      await operator.query(`DROP FUNCTION public.${trigger}()`)
    }
  })
  it('does not turn a current member session into wallet, issuance or provider authority', async () => {
    const result = await asActor(async () => [
      await actions!.getMyWalletBalance(),
      await actions!.issueAward({ awardId: randomUUID() }),
      await actions!.initiateRedemption({}),
    ])
    for (const response of result)
      expect(response).toMatchObject({ success: false, status: 501, code: 'NOT_IMPLEMENTED' })
    await expect(
      asActor(() =>
        savepointHarness.context(RUNTIME_ROLE, org, actor, async (tx) =>
          tx.execute(
            (await import('drizzle-orm'))
              .sql`SELECT balance_after FROM public.reward_wallet_ledger`,
          ),
        ),
      ),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ code: '42501' }) })
  })
  it('returns names only for current canonical members in the peer picker', async () => {
    const names = await asActor(() =>
      savepointHarness.context(RUNTIME_ROLE, org, actor, () =>
        pageReads!.listRecognitionCandidates(org),
      ),
    )
    expect(names).toContainEqual({ userId: recipient, name: 'Native colleague' })
    expect(JSON.stringify(names)).not.toContain('@')
    expect(names.some((row) => row.userId === foreign)).toBe(false)
  })
  it('serializes two genuine concurrent nominations into one pending row and one audit', async () => {
    const nominate = () =>
      asActor(() =>
        actions!.nominatePeer({
          awardTypeId: failedType,
          recipientUserId: recipient,
          reason: 'Concurrent text nomination',
        }),
      )
    const results = await Promise.all([nominate(), nominate()])
    expect(results.filter((result) => result.success)).toHaveLength(1)
    expect(results.filter((result) => !result.success)).toHaveLength(1)
    expect(
      await count('SELECT count(*) AS n FROM public.recognition_awards WHERE award_type_id=$1', [
        failedType,
      ]),
    ).toBe(1)
    expect(
      await count(
        `SELECT count(*) AS n FROM public.audit_logs WHERE organization_id=$1 AND action='rewards.award.nominate' AND details->>'awardTypeId'=$2`,
        [org, failedType],
      ),
    ).toBe(1)
  })
})
