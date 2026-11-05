/**
 * F03-A on real PostgreSQL: row visibility of the governance review register and its event history (cache 0047).
 *
 * DEF-0C1-REV-REVIEW-ROWS-ARE-PROTECTED-BY-AN-ORGANIZATION-ONLY-RLS-POLICY-SO-ADVERSE-PARTY-COMPLAINANT-AND-PRIVILEGE-CONFIDENTIALITY-IS-APPLICATION-CODE-ONLY.
 * The kernel store runs unmodified as the real union_eyes_runtime role under FORCE row-level security with the exact grants the
 * storage-authority manifest activates, against the combined Django + Drizzle schema. Every read below is raw SQL with no application
 * filter, so what comes back is what the database shows. This proves that
 *   - the migration applies twice, rolls back and re-applies; without it a member who is neither party nor overseer reads every review and
 *     every review snapshot in the event history (the control), with it that member reads none;
 *   - the grants are unchanged (SELECT, INSERT, UPDATE, never DELETE) and both tables stay FORCE-RLS with exactly one added restrictive policy;
 *   - an opener or complainant sees their review, a person named as adverse sees nothing even with a live mandate that names the review,
 *     an overseer sees exactly the reviews a live, accepted, unrecused mandate names, and an expired, revoked, unaccepted or recused one sees none;
 *   - the kernel reports a hidden review as not found, so a denial never confirms that someone is a respondent;
 *   - a person who cannot see a review cannot update it, a review cannot name its own opener as adverse, and another organization's mandate confers nothing.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database (the same preparation as
 * authority-kernel-combined.postgres.test.ts). Authority records are append-only, so every run uses fresh organizations and principals.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { authorityKernelEntries } from '../rls-storage-authority/authority-kernel'
import { U, seedMembership, type Db } from './authority-kernel-harness'
import { kit } from './authority-kernel-testkit'
import { auditAuthorityMutation, reconcileAuthorityAudit } from '../../lib/authority/store/audit'
import { enforceAuthority } from '../../lib/authority/store/enforce'
import type { SqlExecutor } from '../../lib/authority/store/executor'
import { membershipSourceVia } from '../../lib/authority/store/identity'
import { acceptInstrument, changeMandate, declareOwnRecusal, liftRecusal } from '../../lib/authority/store/lifecycle'
import { openMemberReview } from '../../lib/authority/store/review-intake'
import { registerReview } from '../../lib/authority/store/workflow'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const adapt = (c: pg.Client): Db => ({ exec: (sql) => c.query(sql), query: (sql, params) => c.query(sql, params as unknown[]) as never })
const MIGRATION = '../migrations-cache/0047_authority_reviews_visibility_rls.sql'
const ROLLBACK = '../migrations-cache/0047_authority_reviews_visibility_rls.rollback.sql'

describe.skipIf(!URL)('review visibility on the combined deployed schema, as the runtime role', () => {
  const sfx = randomUUID().slice(0, 8)
  const ORG = randomUUID()
  const ORG_B = randomUUID()
  const P = {
    opener: `rvn-opener-${sfx}`,
    filer: `rvn-filer-${sfx}`,
    adverse: `rvn-adverse-${sfx}`,
    adverse2: `rvn-adverse2-${sfx}`,
    stranger: `rvn-stranger-${sfx}`,
    overseer: `rvn-overseer-${sfx}`,
    privileged: `rvn-privileged-${sfx}`,
    expiring: `rvn-expiring-${sfx}`,
    revoked: `rvn-revoked-${sfx}`,
    unaccepted: `rvn-unaccepted-${sfx}`,
    recused: `rvn-recused-${sfx}`,
    foreign: `rvn-foreign-${sfx}`,
  }
  let admin: pg.Client
  let runtime: pg.Client
  let identityReader: pg.Client
  let k: ReturnType<typeof kit>
  let R1: string // opened by opener, names adverse
  let R2: string // opened by filer, names adverse2
  let R3: string // privileged, opened by filer, names adverse
  let RB: string // another organization

  const sqlOf = (file: string) => readFileSync(resolve(__dirname, file), 'utf8').split('--> statement-breakpoint')
  // The kit defaults to the harness organization; this suite runs in fresh organizations.
  const as = (user: string, org = ORG) => <T>(fn: (t: SqlExecutor) => Promise<T>): Promise<T> => k.as(user, org)(fn)
  const col = async <T>(user: string, sqlText: string, org = ORG, params: unknown[] = []): Promise<T[]> =>
    as(user, org)(async (t) => (await t.query<{ v: T }>(sqlText, params)).rows.map((row) => row.v))
  const reviews = (user: string, org = ORG) => col<string>(user, `SELECT id::text v FROM ue_authority_reviews ORDER BY id`, org)
  const reviewEvents = (user: string, org = ORG) =>
    col<string>(user, `SELECT DISTINCT source_id::text v FROM ue_authority_events WHERE source_table = 'ue_authority_reviews' ORDER BY 1`, org)
  const sorted = (...ids: string[]) => [...ids].sort()
  const decideMonitor = (user: string, review: string) =>
    as(user)((t) => enforceAuthority(t, k.deps, { principalUserId: user, organizationId: ORG, action: 'review:monitor', resource: { type: 'governance_review', id: review, organizationId: ORG } }, { authenticated: true }))
  const open = (user: string, adverse: string[], org = ORG) =>
    as(user, org)((t) => openMemberReview(t, k.deps, { organizationId: org, actorUserId: user, reviewType: 'complaint', adverseUserIds: adverse })).then((r) => r.id)

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    for (const statement of sqlOf(MIGRATION)) await admin.query(statement)
    const d = adapt(admin)
    for (const [org, slug] of [[ORG, `rvn-a-${sfx}`], [ORG_B, `rvn-b-${sfx}`]]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [org, slug, slug],
      )
    }
    const executives: Array<[string, string]> = [[U.president, 'president'], [U.vp, 'vice_president'], [U.treasurer, 'secretary_treasurer']]
    for (const org of [ORG, ORG_B]) for (const [user, role] of executives) await seedMembership(d, user, org, role)
    for (const user of Object.values(P)) await seedMembership(d, user, ORG, 'member')
    await seedMembership(d, P.opener, ORG_B, 'member')
    await seedMembership(d, P.foreign, ORG_B, 'member')

    runtime = new pg.Client({ connectionString: URL })
    await runtime.connect()
    await runtime.query('SET ROLE union_eyes_runtime')
    identityReader = new pg.Client({ connectionString: URL })
    await identityReader.connect()
    await identityReader.query('SET ROLE union_eyes_system')
    k = kit(adapt(runtime), membershipSourceVia(identityReader as unknown as SqlExecutor))
    await k.adoptDefaultRules(
      ORG,
      (domain, operation) => (domain === 'governance_review' && ['issue', 'revoke'].includes(operation)) || (domain === 'recusal' && operation === 'lift'),
    )
    await k.adoptDefaultRules(ORG_B, (domain, operation) => domain === 'governance_review' && operation === 'issue')

    R1 = await open(P.opener, [P.adverse])
    R2 = await open(P.filer, [P.adverse2])
    R3 = await as(P.filer)((t) => registerReview(t, k.deps, { organizationId: ORG, openedBy: P.filer, complainantUserId: P.filer, reviewType: 'complaint', adverseUserIds: [P.adverse], classification: 'privileged' }))
    RB = await open(P.opener, [], ORG_B)
  }, 300_000)

  afterAll(async () => {
    await runtime?.end().catch(() => undefined)
    await identityReader?.end().catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  describe('the migration and the catalog', () => {
    it('applies twice, rolls back and re-applies, all inside a transaction that is then discarded', async () => {
      await admin.query('BEGIN')
      try {
        for (const statement of sqlOf(MIGRATION)) await admin.query(statement)
        for (const statement of sqlOf(MIGRATION)) await admin.query(statement)
        const names = `ARRAY['ue_authority_reviews_visibility', 'ue_authority_events_review_visibility']`
        expect(Number((await admin.query(`SELECT count(*) n FROM pg_policies WHERE policyname = ANY (${names})`)).rows[0].n)).toBe(2)
        await admin.query(sqlOf(ROLLBACK).join(';'))
        expect(Number((await admin.query(`SELECT count(*) n FROM pg_policies WHERE policyname = ANY (${names})`)).rows[0].n)).toBe(0)
        for (const statement of sqlOf(MIGRATION)) await admin.query(statement)
        expect(Number((await admin.query(`SELECT count(*) n FROM pg_policies WHERE policyname = ANY (${names})`)).rows[0].n)).toBe(2)
      } finally {
        await admin.query('ROLLBACK')
      }
    })

    it('adds exactly one restrictive SELECT policy for the runtime role to each table, and leaves every grant and the FORCE RLS state alone', async () => {
      const policies = await admin.query(
        `SELECT tablename, policyname, permissive, cmd, roles::text roles FROM pg_policies WHERE permissive = 'RESTRICTIVE' AND tablename = ANY ($1::text[]) ORDER BY tablename`,
        [authorityKernelEntries.map((e) => e.table)],
      )
      expect(policies.rows).toEqual([
        { tablename: 'ue_authority_events', policyname: 'ue_authority_events_review_visibility', permissive: 'RESTRICTIVE', cmd: 'SELECT', roles: '{union_eyes_runtime}' },
        { tablename: 'ue_authority_reviews', policyname: 'ue_authority_reviews_visibility', permissive: 'RESTRICTIVE', cmd: 'SELECT', roles: '{union_eyes_runtime}' },
      ])
      for (const table of ['ue_authority_reviews', 'ue_authority_events']) {
        expect(Number((await admin.query(`SELECT count(*) n FROM pg_policies WHERE tablename = $1`, [table])).rows[0].n)).toBe(6)
        expect((await admin.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = $1::regclass`, [table])).rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true })
        const entry = authorityKernelEntries.find((e) => e.table === table)!
        const live: string[] = []
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
          if ((await admin.query(`SELECT has_table_privilege('union_eyes_runtime', $1::regclass, $2) ok`, [table, privilege])).rows[0].ok) live.push(privilege)
        }
        expect(live.sort(), table).toEqual([...entry.requiredRuntimePrivileges].sort())
      }
    })

    it('control: without the policies a member who is neither party nor overseer reads every review and every review snapshot', async () => {
      await admin.query('BEGIN')
      try {
        await admin.query('DROP POLICY ue_authority_reviews_visibility ON ue_authority_reviews')
        await admin.query('DROP POLICY ue_authority_events_review_visibility ON ue_authority_events')
        await admin.query('SET LOCAL ROLE union_eyes_runtime')
        await admin.query(`SELECT set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true)`, [ORG, P.stranger])
        const rows = (await admin.query(`SELECT id::text id, array_to_string(adverse_user_ids, ',') adverse FROM ue_authority_reviews`)).rows
        expect(rows.map((r) => r.id).sort()).toEqual(sorted(R1, R2, R3))
        expect(rows.find((r) => r.id === R1)!.adverse).toEqual(P.adverse)
        const snapshots = (await admin.query(`SELECT row_after FROM ue_authority_events WHERE source_table = 'ue_authority_reviews'`)).rows
        expect(snapshots.length).toBeGreaterThanOrEqual(3)
      } finally {
        await admin.query('ROLLBACK')
      }
      expect(await reviews(P.stranger)).toEqual([])
    })
  })

  describe('participants and strangers', () => {
    it('a member sees only the reviews they opened or filed, however the register is queried', async () => {
      expect(await reviews(P.opener)).toEqual([R1])
      expect(await reviews(P.filer)).toEqual(sorted(R2, R3))
      expect(await reviews(P.stranger)).toEqual([])
      expect(await reviews(U.president)).toEqual([])
      expect(await col(P.stranger, `SELECT count(*)::int v FROM ue_authority_reviews`)).toEqual([0])
      expect(await col(P.stranger, `SELECT id::text v FROM ue_authority_reviews WHERE id = $1`, ORG, [R1])).toEqual([])
      expect(await col(P.stranger, `SELECT count(*)::int v FROM ue_authority_reviews WHERE organization_id = $1`, ORG, [ORG])).toEqual([0])
    })

    it('no authenticated principal shows nothing', async () => {
      for (const principal of ['', ' ']) {
        await admin.query('BEGIN')
        try {
          await admin.query('SET LOCAL ROLE union_eyes_runtime')
          await admin.query(`SELECT set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true)`, [ORG, principal])
          expect(Number((await admin.query(`SELECT count(*) n FROM ue_authority_reviews`)).rows[0].n)).toBe(0)
          expect(Number((await admin.query(`SELECT count(*) n FROM ue_authority_events WHERE source_table = 'ue_authority_reviews'`)).rows[0].n)).toBe(0)
        } finally {
          await admin.query('ROLLBACK')
        }
      }
    })
  })

  describe('adverse parties', () => {
    it('a person named as adverse sees nothing of the review, even with a live mandate that names it', async () => {
      expect(await reviews(P.adverse)).toEqual([])
      await k.grantMandate('governance_review', P.adverse, ['monitor', 'access_evidence'], { scope: { resourceIds: [R1, R3] } }, ORG)
      expect(await reviews(P.adverse)).toEqual([])
      expect(await col(P.adverse, `SELECT id::text v FROM ue_authority_reviews WHERE id = ANY ($1::uuid[])`, ORG, [[R1, R3]])).toEqual([])
      expect(await reviewEvents(P.adverse)).toEqual([])
    })

    it('the kernel reports such a review as not found, exactly as it reports a review that does not exist', async () => {
      const adverse = await decideMonitor(P.adverse, R1)
      expect(adverse.effect).toBe('deny')
      expect(adverse.reasons.map((r) => r.code)).toEqual(['RESOURCE_FACTS_MISSING'])
      expect((await decideMonitor(P.stranger, R1)).reasons.map((r) => r.code)).toEqual(['RESOURCE_FACTS_MISSING'])
      expect((await decideMonitor(P.adverse, randomUUID())).reasons.map((r) => r.code)).toEqual(['RESOURCE_FACTS_MISSING'])
    })

    it('someone who cannot see a review cannot close or reassign it', async () => {
      const touched = await as(P.adverse)(async (t) => {
        const closed = await t.query(`UPDATE ue_authority_reviews SET status = 'closed', closed_at = now() WHERE id = $1 RETURNING id`, [R1])
        const owned = await t.query(`UPDATE ue_authority_reviews SET remediation_owner_user_id = $2 WHERE id = $1 RETURNING id`, [R1, P.adverse])
        return closed.rows.length + owned.rows.length
      })
      expect(touched).toBe(0)
      expect((await admin.query(`SELECT status, remediation_owner_user_id FROM ue_authority_reviews WHERE id = $1`, [R1])).rows[0]).toEqual({ status: 'open', remediation_owner_user_id: null })
    })

    it('a review cannot be recorded with its own opener or complainant as an adverse party', async () => {
      const before = Number((await admin.query(`SELECT count(*) n FROM ue_authority_reviews WHERE organization_id = $1`, [ORG])).rows[0].n)
      await expect(as(P.opener)((t) => registerReview(t, k.deps, { organizationId: ORG, openedBy: P.opener, complainantUserId: P.opener, reviewType: 'complaint', adverseUserIds: [P.opener] })))
        .rejects.toMatchObject({ code: 'INVALID_CONTEXT', message: expect.stringContaining('SELF_ADVERSE') })
      await expect(as(P.opener)((t) => t.query(
        `INSERT INTO ue_authority_reviews (organization_id, review_type, complainant_user_id, adverse_user_ids, opened_by) VALUES ($1::uuid,'complaint',$2::text,ARRAY[$2::text],$2::text) RETURNING id`,
        [ORG, P.opener],
      ))).rejects.toThrow(/row-level security/)
      expect(Number((await admin.query(`SELECT count(*) n FROM ue_authority_reviews WHERE organization_id = $1`, [ORG])).rows[0].n)).toBe(before)
    })
  })

  describe('overseers', () => {
    it('an overseer sees exactly the reviews a live mandate names, and the kernel agrees', async () => {
      expect(await reviews(P.overseer)).toEqual([])
      await k.grantMandate('governance_review', P.overseer, ['monitor'], { scope: { resourceIds: [R1, R2] } }, ORG)
      expect(await reviews(P.overseer)).toEqual(sorted(R1, R2))
      expect(await reviewEvents(P.overseer)).toEqual(sorted(R1, R2))
      expect((await decideMonitor(P.overseer, R1)).effect).toBe('allow')
      expect((await decideMonitor(P.overseer, R3)).reasons.map((r) => r.code)).toEqual(['RESOURCE_FACTS_MISSING'])
    })

    it('a privileged review is visible to the same people only, and the kernel still withholds its evidence', async () => {
      expect(await reviews(P.filer)).toContain(R3)
      expect(await reviews(P.overseer)).not.toContain(R3)
      await k.grantMandate('governance_review', P.privileged, ['monitor', 'access_evidence'], { scope: { resourceIds: [R3] } }, ORG)
      expect(await reviews(P.privileged)).toEqual([R3])
      expect(await col(P.privileged, `SELECT classification v FROM ue_authority_reviews`)).toEqual(['privileged'])
      const evidence = await as(P.privileged)((t) => enforceAuthority(t, k.deps, { principalUserId: P.privileged, organizationId: ORG, action: 'review:access_evidence', resource: { type: 'governance_review', id: R3, organizationId: ORG } }, { authenticated: true }))
      expect(evidence.effect).toBe('deny')
      expect(evidence.reasons.map((r) => r.code)).toContain('PRIVILEGED_MATTER')
    })

    it('an expired mandate shows nothing', async () => {
      await k.grantMandate('governance_review', P.expiring, ['monitor'], { scope: { resourceIds: [R2] }, expiresAt: new Date(Date.now() + 5000) }, ORG)
      expect(await reviews(P.expiring)).toEqual([R2])
      await new Promise((resolve) => setTimeout(resolve, 5500))
      expect(await reviews(P.expiring)).toEqual([])
      expect(await reviewEvents(P.expiring)).toEqual([])
    }, 60_000)

    it('a revoked mandate shows nothing', async () => {
      const mandate = await k.grantMandate('governance_review', P.revoked, ['monitor'], { scope: { resourceIds: [R2] } }, ORG)
      expect(await reviews(P.revoked)).toEqual([R2])
      await as(U.president)((t) => changeMandate(t, k.deps, { organizationId: ORG, issuerUserId: U.president, mandateId: mandate, change: 'revoke' }))
      expect(await reviews(P.revoked)).toEqual([])
    })

    it('a mandate the holder has not accepted shows nothing until they accept it', async () => {
      const mandate = await k.grantMandate('governance_review', P.unaccepted, ['monitor'], { scope: { resourceIds: [R2] }, accept: false }, ORG)
      expect(await reviews(P.unaccepted)).toEqual([])
      await as(P.unaccepted)((t) => acceptInstrument(t, { organizationId: ORG, instrumentType: 'mandate', instrumentId: mandate, holderUserId: P.unaccepted }))
      expect(await reviews(P.unaccepted)).toEqual([R2])
    })

    it('a recused overseer sees nothing until the recusal is lifted', async () => {
      await k.grantMandate('governance_review', P.recused, ['monitor'], { scope: { resourceIds: [R2] } }, ORG)
      expect(await reviews(P.recused)).toEqual([R2])
      const recusal = await as(P.recused)((t) => declareOwnRecusal(t, { organizationId: ORG, principalUserId: P.recused, resourceType: 'governance_review', resourceId: R2, reason: 'personal conflict' }))
      expect(await reviews(P.recused)).toEqual([])
      await as(U.president)((t) => liftRecusal(t, k.deps, { organizationId: ORG, issuerUserId: U.president, recusalId: recusal }))
      expect(await reviews(P.recused)).toEqual([R2])
    })

    it('an overseer can act on a review they can see, and the audit link of that act still commits', async () => {
      const updated = await as(P.overseer)(async (t) => {
        const result = await t.query<{ id: string }>(`UPDATE ue_authority_reviews SET remediation_owner_user_id = $2 WHERE id = $1 RETURNING id::text id`, [R1, U.treasurer])
        await auditAuthorityMutation(t, { organizationId: ORG, action: 'review.update.test', resourceType: 'ue_authority_reviews', resourceId: R1 })
        return result.rows.map((row) => row.id)
      })
      expect(updated).toEqual([R1])
      expect(await reviewEvents(P.opener)).toEqual([R1])
    })
  })

  describe('other organizations', () => {
    it('a principal reads only the reviews of the organization context, and a mandate elsewhere confers nothing here', async () => {
      expect(await reviews(P.opener, ORG_B)).toEqual([RB])
      expect(await col(P.opener, `SELECT id::text v FROM ue_authority_reviews WHERE organization_id = $1`, ORG_B, [ORG])).toEqual([])
      await k.grantMandate('governance_review', P.foreign, ['monitor'], { scope: { resourceIds: [R1, RB] } }, ORG_B)
      expect(await reviews(P.foreign, ORG_B)).toEqual([RB])
      expect(await reviews(P.foreign, ORG)).toEqual([])
    })
  })

  describe('the event history', () => {
    it('an event of a review is visible exactly where the review is, and nowhere else', async () => {
      expect(await reviewEvents(P.opener)).toEqual([R1])
      expect(await reviewEvents(P.filer)).toEqual(sorted(R2, R3))
      expect(await reviewEvents(P.stranger)).toEqual([])
      expect(await reviewEvents(P.adverse)).toEqual([])
      expect(await col(P.filer, `SELECT DISTINCT row_after ->> 'complainant_user_id' v FROM ue_authority_events WHERE source_table = 'ue_authority_reviews'`)).toEqual([P.filer])
      expect(await col(P.stranger, `SELECT actor_user_id v FROM ue_authority_events WHERE source_id = $1`, ORG, [R1])).toEqual([])
    })

    it('events of every other authority relation stay organization-readable, as the kernel needs', async () => {
      const mandates = (await col<number>(P.stranger, `SELECT count(*)::int v FROM ue_authority_events WHERE source_table = 'ue_authority_mandates'`))[0]
      expect(mandates).toBeGreaterThan(0)
    })

    it('the audit reconciliation, which must read every event, is clean for a role that is not narrowed', async () => {
      for (const org of [ORG, ORG_B]) {
        expect(await reconcileAuthorityAudit(admin as unknown as SqlExecutor, org)).toEqual({ eventsWithoutAudit: [], auditRowsWithUnknownEvents: [], chainBreaks: [] })
      }
    })
  })

  describe('rollback restores the earlier behaviour', () => {
    it('after the rollback statements the stranger reads again (inside a discarded transaction)', async () => {
      await admin.query('BEGIN')
      try {
        await admin.query(sqlOf(ROLLBACK).join(';'))
        await admin.query('SET LOCAL ROLE union_eyes_runtime')
        await admin.query(`SELECT set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true)`, [ORG, P.stranger])
        expect(Number((await admin.query(`SELECT count(*) n FROM ue_authority_reviews`)).rows[0].n)).toBeGreaterThanOrEqual(3)
      } finally {
        await admin.query('ROLLBACK')
      }
      expect(await reviews(P.stranger)).toEqual([])
    })
  })
})
