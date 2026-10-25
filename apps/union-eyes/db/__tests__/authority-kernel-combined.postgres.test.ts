/**
 * The authority kernel against the COMBINED deployed schema, as the runtime role, with
 * the grants activated by the approved bootstrap. Unlike the PGlite suites and the
 * Django-audit suite, nothing here is mirrored: the tables are whatever Django `migrate`
 * plus the approved Drizzle bootstrap (`run-union-eyes-drizzle-bootstrap.mjs`) created.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to such a
 * FRESH disposable database (see docs/union-eyes/convergence/UE-AUTHORITY-KERNEL-PHASE-1-EXIT-EVIDENCE.md
 * for the exact preparation commands). Authority records are append-only and cannot be
 * cleaned up, so use a new database per run.
 *
 * Findings this suite pins (each is a fail-closed behaviour, not a pass of the feature):
 *   - public.platform_identity_bindings is not in the approved lineage, so provider
 *     resolution must refuse;
 *   - public.payments gains amount, currency and payer only through platform 0015, as nullable columns that
 *     invent no value, so an unregistered or incomplete payment still denies every financial decision.
 * Not a staging isolation pass.
 */
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { authorityKernelEntries } from '../rls-storage-authority/authority-kernel'
import { ORG, ORG_B, newUuid, seedMembership, seedUser, U, type Db } from './authority-kernel-harness'
import { daysAhead, kit, minutesAgo } from './authority-kernel-testkit'
import { reconcileAuthorityAudit } from '../../lib/authority/store/audit'
import { enforceAuthority, enforceDocumentRead } from '../../lib/authority/store/enforce'
import { runAuthorityTransaction, type SqlExecutor } from '../../lib/authority/store/executor'
import { financeSourceReadiness } from '../../lib/authority/store/resources'
import { recordFinancialStep } from '../../lib/authority/store/workflow'
import { canonicalMembershipSource, membershipSourceVia } from '../../lib/authority/store/identity'
import { issueMandate, declareOwnRecusal } from '../../lib/authority/store/lifecycle'
import type { Action } from '../../lib/authority/ontology'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const adapt = (c: pg.Client): Db => ({ exec: (sql) => c.query(sql), query: (sql, params) => c.query(sql, params as unknown[]) as never })

describe.skipIf(!URL)('authority kernel on the combined deployed schema, as the runtime role', () => {
  let admin: pg.Client
  let runtime: pg.Client
  let identityReader: pg.Client
  const CASE = newUuid()
  const PAYMENT = newUuid()

  const asUser = <T>(user: string, fn: (t: SqlExecutor) => Promise<T>, org = ORG) =>
    runAuthorityTransaction(runtime as unknown as SqlExecutor, { organizationId: org, userId: user }, fn)
  const decide = (user: string, action: Action, type: 'case' | 'financial_transaction', id: string, org = ORG) =>
    asUser(user, (t) => enforceAuthority(t, { memberships: canonicalMembershipSource }, { principalUserId: user, organizationId: org, action, resource: { type, id, organizationId: org } }, { authenticated: true }), org)

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    const d = adapt(admin)
    for (const [org, slug] of [[ORG, 'combined-a'], [ORG_B, 'combined-b']]) {
      await admin.query(`INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
        VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1) ON CONFLICT (id) DO NOTHING`, [org, slug, slug])
    }
    const roles: Record<string, string> = { [U.president]: 'president', [U.vp]: 'vice_president', [U.treasurer]: 'secretary_treasurer', [U.steward]: 'steward', [U.chief]: 'chief_steward', [U.member]: 'member', [U.stranger]: 'member', [U.officer]: 'officer' }
    for (const [u, r] of Object.entries(roles)) await seedMembership(d, u, ORG, r)
    await seedUser(d, 'user_other_org')
    await seedMembership(d, 'user_other_org', ORG_B, 'president')
    await admin.query(`INSERT INTO grievances (id, organization_id, created_by, created_at, updated_at, has_legal_implications, is_arbitration_eligible, is_confidential, is_group_grievance, priority, status)
      VALUES ($1,$2,$3, now(), now(), false, false, false, false, 'medium', 'open') ON CONFLICT (id) DO NOTHING`, [CASE, ORG, U.member])
    await admin.query(`INSERT INTO payments (id, organization_id, created_at, updated_at, type, method) VALUES ($1,$2,now(),now(),'dues','cash') ON CONFLICT (id) DO NOTHING`, [PAYMENT, ORG])
    runtime = new pg.Client({ connectionString: URL })
    await runtime.connect()
    await runtime.query('SET ROLE union_eyes_runtime')
    // The bounded, read-only identity role the deployed schema provides for cross-principal reads.
    identityReader = new pg.Client({ connectionString: URL })
    await identityReader.connect()
    await identityReader.query('SET ROLE union_eyes_system')
  }, 120_000)

  afterAll(async () => {
    await runtime?.end().catch(() => undefined)
    await identityReader?.end().catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  it('live runtime privileges equal the storage-authority registry exactly, and never include DELETE', async () => {
    for (const e of authorityKernelEntries) {
      const live: string[] = []
      for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
        const r = await admin.query(`SELECT has_table_privilege('union_eyes_runtime', $1::regclass, $2) AS ok`, [e.table, p])
        if (r.rows[0].ok) live.push(p)
      }
      expect(live.sort(), e.table).toEqual([...e.requiredRuntimePrivileges].sort())
      expect(live, e.table).not.toContain('DELETE')
    }
  })

  it('the runtime role cannot delete, truncate, alter or disable the guards on authority tables', async () => {
    for (const e of authorityKernelEntries) {
      await expect(runtime.query(`DELETE FROM ${e.table}`), e.table).rejects.toThrow(/permission denied/)
      await expect(runtime.query(`TRUNCATE ${e.table}`), e.table).rejects.toThrow(/permission denied/)
      await expect(runtime.query(`ALTER TABLE ${e.table} DISABLE TRIGGER ALL`), e.table).rejects.toThrow(/must be owner|permission denied/)
    }
    await expect(runtime.query(`DROP TRIGGER ue_authority_guard_actor ON ue_authority_mandates`)).rejects.toThrow(/must be owner|permission denied/)
  })

  it('every authority table has FORCE RLS and the runtime role bypasses nothing', async () => {
    const r = await admin.query(`SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity FROM pg_class c WHERE c.relname LIKE 'ue_authority_%' AND c.relkind = 'r'`)
    expect(r.rows).toHaveLength(21)
    for (const row of r.rows) expect([row.relname, row.relrowsecurity, row.relforcerowsecurity]).toEqual([row.relname, true, true])
    const role = await admin.query(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'union_eyes_runtime'`)
    expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false })
  })

  it('identity: membership comes from the deployed user_management tables, per tenant, failing closed', async () => {
    const m = (user: string, org = ORG) => asUser(user, (t) => canonicalMembershipSource(t, org, [user]), org)
    expect((await m(U.president))[0]).toMatchObject({ userId: U.president, organizationId: ORG, status: 'active' })
    expect(await m('user_other_org')).toEqual([]) // a member of ANOTHER organization has no standing here
    await admin.query(`UPDATE user_management.organization_users SET is_active = false WHERE user_id = $1 AND organization_id = $2`, [U.stranger, ORG])
    expect((await m(U.stranger)).every((x) => x.status !== 'active')).toBe(true)
    await admin.query(`UPDATE user_management.users SET lifecycle_state = 'suspended' WHERE user_id = $1`, [U.officer])
    expect((await m(U.officer)).every((x) => x.status !== 'active')).toBe(true)
    await admin.query(`UPDATE user_management.users SET lifecycle_state = 'active' WHERE user_id = $1`, [U.officer])
  })

  it('FINDING: the runtime role sees only its OWN membership row, so cross-principal identity must come from the bounded system reader', async () => {
    const asRuntime = (org = ORG) => asUser(U.president, (t) => canonicalMembershipSource(t, org, [U.president, U.vp, U.treasurer]))
    const seen = await asRuntime()
    expect(seen.map((m) => m.userId)).toEqual([U.president]) // vice-president and treasurer are invisible: self-select RLS
    const viaSystem = await membershipSourceVia(identityReader as unknown as SqlExecutor)({} as never, ORG, [U.president, U.vp, U.treasurer])
    expect(viaSystem.map((m) => m.userId).sort()).toEqual([U.president, U.treasurer, U.vp].sort())
    expect(viaSystem.every((m) => m.status === 'active')).toBe(true)
    // The system reader is read-only on exactly these tables and cannot touch authority state.
    await expect(identityReader.query(`UPDATE user_management.organization_users SET role = 'president' WHERE user_id = $1`, [U.member])).rejects.toThrow(/permission denied/)
    await expect(identityReader.query(`SELECT 1 FROM ue_authority_mandates`)).rejects.toThrow(/permission denied/)
    // Foreign tenants stay invisible even through the system reader: the query is bound to the explicit organization.
    expect(await membershipSourceVia(identityReader as unknown as SqlExecutor)({} as never, ORG_B, [U.president])).toEqual([])
  })

  it('FINDING: the provider-binding table is not in this lineage, and no business role could read it if it were', async () => {
    const exists = await admin.query(`SELECT to_regclass('public.platform_identity_bindings') AS t`)
    expect(exists.rows[0].t).toBeNull()
    // The authority kernel has no provider resolver of its own: identity comes only from a verified binding.
    const kernel = await import('../../lib/authority/store/identity')
    expect(Object.keys(kernel)).not.toContain('resolveInternalPrincipal')
  })
  it('case access on the real grievances table: creator yes; a steward by rank, a stranger and another tenant no', async () => {
    expect((await decide(U.member, 'case:read', 'case', CASE)).effect).toBe('allow')
    for (const who of [U.steward, U.chief, U.stranger, U.president]) expect((await decide(who, 'case:read', 'case', CASE)).effect, who).toBe('deny')
    const foreign = await decide('user_other_org', 'case:read', 'case', CASE, ORG_B)
    expect(foreign.effect).toBe('deny')
    // Another tenant's session cannot even see the row.
    expect((await asUser('user_other_org', (t) => t.query(`SELECT 1 FROM grievances WHERE id = $1`, [CASE]), ORG_B)).rows).toHaveLength(0)
  })

  it('classified documents on the real tables: own submission yes, union internal file no, privileged no', async () => {
    const [own, internal, publicInternal, privileged] = [newUuid(), newUuid(), newUuid(), newUuid()]
    const ins = (id: string, by: string, label: string, priv: boolean) => admin.query(
      `INSERT INTO documents (id, created_at, updated_at, organization_id, uploaded_by, access_level, contains_legal_privilege, contains_medical_sensitive, contains_pii, is_confidential, privacy_label, status)
       VALUES ($1, now(), now(), $2, $3, 'team', $4, false, false, false, $5, 'active')`, [id, ORG, by, priv, label])
    await ins(own, U.member, 'team_confidential', false)
    await ins(internal, U.officer, 'team_confidential', false)
    await ins(publicInternal, U.officer, 'public_internal', false)
    await ins(privileged, U.member, 'team_confidential', true)
    for (const d of [own, internal, publicInternal, privileged]) {
      await admin.query(`INSERT INTO document_links (organization_id, document_id, linked_entity_type, linked_entity_id, linked_by) VALUES ($1,$2,'grievance',$3,$4)`, [ORG, d, CASE, U.officer])
    }
    const read = (user: string, doc: string) => asUser(user, (t) => enforceDocumentRead(t, { memberships: canonicalMembershipSource }, { principalUserId: user, organizationId: ORG, documentId: doc, authenticated: true }))
    expect((await read(U.member, own)).effect).toBe('allow')
    expect((await read(U.member, publicInternal)).effect).toBe('deny') // a label alone never makes a record member-disclosable
    expect((await read(U.member, internal)).effect).toBe('deny')
    expect((await read(U.member, privileged)).effect).toBe('deny')
    for (const who of [U.president, U.steward, U.stranger]) expect((await read(who, own)).effect, who).toBe('deny')
  })

  it('payments carries the transaction source columns (platform 0015) without inventing values, and finance still denies an unregistered or incomplete payment', async () => {
    const cols = (await admin.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments'`)).rows.map((r) => r.column_name)
    expect(cols).toEqual(expect.arrayContaining(['amount', 'currency', 'member_id']))
    expect(await asUser(U.treasurer, (t) => financeSourceReadiness(t))).toEqual({ ready: true, missingColumns: [] })
    // The pre-existing row has no amount or payer; the currency is only the declared column default (platform 0018).
    expect((await admin.query(`SELECT amount, currency, member_id FROM payments WHERE id = $1`, [PAYMENT])).rows[0]).toEqual({ amount: null, currency: 'CAD', member_id: null })
    // Integrity: a negative amount and a malformed currency are refused by the database.
    await expect(admin.query(`UPDATE payments SET amount = -1 WHERE id = $1`, [PAYMENT])).rejects.toThrow(/payments_amount_non_negative/)
    await expect(admin.query(`UPDATE payments SET currency = 'cad' WHERE id = $1`, [PAYMENT])).rejects.toThrow(/payments_currency_iso_shape/)
    // A payment with no amount cannot be registered as a finance transaction, and nobody is authorized against it.
    await expect(
      asUser(U.treasurer, (t) => recordFinancialStep(t, { memberships: canonicalMembershipSource }, { organizationId: ORG, actorUserId: U.treasurer, paymentId: PAYMENT, step: 'registered', accountId: newUuid(), requiredApprovals: 1 })),
    ).rejects.toThrow()
    for (const action of ['finance:view', 'finance:prepare', 'finance:approve', 'finance:execute', 'finance:reconcile'] as Action[]) {
      for (const who of [U.president, U.treasurer, U.member]) {
        expect((await decide(who, action, 'financial_transaction', PAYMENT)).effect, `${who} ${action}`).toBe('deny')
      }
    }
    // The runtime role writes the new columns only inside its own organization.
    const OWN = newUuid()
    await asUser(U.treasurer, (t) => t.query(`INSERT INTO payments (id, organization_id, created_at, updated_at, type, method, amount, currency, member_id) VALUES ($1,$2,now(),now(),'dues','cash','125.50','CAD',$3)`, [OWN, ORG, U.member]))
    await expect(
      asUser(U.treasurer, (t) => t.query(`INSERT INTO payments (id, organization_id, created_at, updated_at, type, method, amount, currency) VALUES ($1,$2,now(),now(),'dues','cash','1.00','CAD')`, [newUuid(), ORG_B])),
    ).rejects.toThrow(/row-level security/)
    // Unregistered, so still denied even with a complete source row.
    expect((await decide(U.treasurer, 'finance:view', 'financial_transaction', OWN)).effect).toBe('deny')
  })

  it('governed issuance on deployed grants: ceremony, mandate, audit chain; forged actors refused', async () => {
    const k = kit(adapt(runtime), membershipSourceVia(identityReader as unknown as SqlExecutor))
    await k.adoptDefaultRules()
    const mandateId = await k.grantOffice(U.vp, U.president, U.treasurer)
    expect(mandateId).toBeTruthy()
    await expect(asUser(U.officer, (t) => issueMandate(t, k.deps, { organizationId: ORG, issuerUserId: U.president, holderUserId: U.chief, kind: 'supervisory', powers: ['read'], scope: { resourceIds: [CASE] }, sourceInstrument: 'x', effectiveAt: minutesAgo(), expiresAt: daysAhead(5) }))).rejects.toThrow(/ACTOR_NOT_SESSION/)
    await asUser(U.member, (t) => declareOwnRecusal(t, { organizationId: ORG, principalUserId: U.member, resourceType: 'case', resourceId: CASE, reason: 'relative of respondent' }))
    expect(await asUser(U.president, (t) => reconcileAuthorityAudit(t, ORG))).toEqual({ eventsWithoutAudit: [], auditRowsWithUnknownEvents: [], chainBreaks: [] })
    // No authenticated principal, no write, even with every other column valid.
    await expect(runtime.query(`INSERT INTO ue_authority_recusals (organization_id, principal_user_id, resource_type, resource_id, reason) VALUES ($1,$2,'case',$3,'x')`, [ORG, U.member, newUuid()])).rejects.toThrow(/ACTOR_NOT_SESSION|row-level security/)
  }, 180_000)
})
