/**
 * Authority kernel on REAL PostgreSQL: concurrency, crash and retry.
 *
 * Skipped unless UE_AUTHORITY_PG_URL points at a disposable PostgreSQL server whose
 * user may CREATE DATABASE / CREATE ROLE (the roles are cluster-global and idempotent), e.g.
 *   docker run -d --name ue-authority-pg16 -e POSTGRES_PASSWORD=pw -p 55434:5432 postgres:16-alpine
 *   UE_AUTHORITY_PG_URL=postgres://postgres:pw@localhost:55434/postgres
 * Run it against postgres:15 and postgres:16. Each run creates and drops its own
 * database and never touches existing data. This is not a staging isolation pass.
 */
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { newUuid, ORG, installAuthoritySchema, seedCast, U, type Db } from './authority-kernel-harness'
import { daysAhead, kit, minutesAgo } from './authority-kernel-testkit'
import { canonicalAuditContentHash } from '../../lib/audit/canonical-audit-chain'
import { reconcileAuthorityAudit } from '../../lib/authority/store/audit'
import type { SqlExecutor } from '../../lib/authority/store/executor'
import { runAuthorityTransaction } from '../../lib/authority/store/executor'
import { runIdempotent } from '../../lib/authority/store/idempotency'
import { acceptInstrument, declareOwnRecusal, issueDelegation, issueMandate, requestIssuanceApproval } from '../../lib/authority/store/lifecycle'
import { insertRecusal, openApprovalRequest, recordApprovalDecision } from '../../lib/authority/store/mutations'
import { recordFinancialStep } from '../../lib/authority/store/workflow'

const URL = process.env.UE_AUTHORITY_PG_URL

const adapt = (c: pg.Client): Db => ({ exec: (sql) => c.query(sql), query: (sql, params) => c.query(sql, params as unknown[]) as never })

describe.skipIf(!URL)('authority storage on real PostgreSQL', () => {
  const dbName = `ue_authority_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  let admin: pg.Client
  let setup: pg.Client
  const clients: pg.Client[] = []
  let version = ''

  const dbUrl = () => {
    const u = new globalThis.URL(URL!)
    u.pathname = `/${dbName}`
    return u.toString()
  }
  async function conn(asRuntime = true): Promise<pg.Client> {
    const c = new pg.Client({ connectionString: dbUrl() })
    // A backend killed on purpose (crash test) emits 'error' on its client; that is expected, not a failure.
    c.on('error', () => undefined)
    await c.connect()
    if (asRuntime) await c.query('SET ROLE union_eyes_runtime')
    clients.push(c)
    return c
  }
  const kitFor = (c: pg.Client) => kit(adapt(c))
  const run = <T>(c: pg.Client, user: string, fn: (t: SqlExecutor) => Promise<T>) =>
    runAuthorityTransaction(c as unknown as SqlExecutor, { organizationId: ORG, userId: user }, fn)
  const n = async (sql: string, params: unknown[] = []) => Number((await setup.query(sql, params)).rows[0].n)

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    await admin.query(`CREATE DATABASE ${dbName}`)
    setup = new pg.Client({ connectionString: dbUrl() })
    await setup.connect()
    version = (await setup.query('SHOW server_version')).rows[0].server_version
    await installAuthoritySchema(adapt(setup))
    await seedCast(adapt(setup))
    const c = await conn()
    await kitFor(c).adoptDefaultRules()
    await setup.query(`INSERT INTO public.grievances (id, organization_id, created_by) VALUES ($1,$2,$3)`, [CASE_ID, ORG, U.member])
  })

  afterAll(async () => {
    for (const c of clients) await c.end().catch(() => undefined)
    await setup?.end().catch(() => undefined)
    await admin?.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`)
    await admin?.end()
  })

  const CASE_ID = newUuid()
  const open = (c: pg.Client, over: Record<string, unknown> = {}) =>
    run(c, U.officer, (t) => openApprovalRequest(t, {
      organizationId: ORG, subjectType: 'bylaw_amendment', subjectId: newUuid(), proposedBy: U.officer, requiredApprovals: 2, riskClass: 'medium',
      namedApproverIds: [U.president, U.vp, U.treasurer], ...over }))
  const snapshot = async (rid: string) => {
    const r = await setup.query(`SELECT r.status, (SELECT count(*) FROM ue_authority_approval_decisions d WHERE d.approval_request_id = r.id AND d.decision = 'approved')::int approvals FROM ue_authority_approval_requests r WHERE r.id = $1`, [rid])
    return { status: r.rows[0].status as string, approvals: r.rows[0].approvals as number }
  }
  const approve = (c: pg.Client, rid: string, who: string, extra: Record<string, unknown> = {}) =>
    run(c, who, (t) => recordApprovalDecision(t, kitFor(c).deps, { organizationId: ORG, approvalRequestId: rid, approverUserId: who, decision: 'approved', ...extra }))
  const trio = async () => [await conn(), await conn(), await conn()] as const

  it('runs on the intended server', () => {
    expect(version.length).toBeGreaterThan(0)
  })

  it('two approvers racing on a 2-approval request both land and the request resolves to satisfied exactly once', async () => {
    const [a, b, c] = await trio()
    for (let i = 0; i < 15; i++) {
      const rid = await open(c)
      const results = await Promise.allSettled([approve(a, rid, U.president), approve(b, rid, U.vp)])
      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled'])
      expect(await snapshot(rid)).toEqual({ status: 'satisfied', approvals: 2 })
    }
  })

  it('two approvers racing on a 1-approval request: exactly one decision is recorded, the other is refused', async () => {
    const [a, b, c] = await trio()
    for (let i = 0; i < 15; i++) {
      const rid = await open(c, { requiredApprovals: 1 })
      const results = await Promise.allSettled([approve(a, rid, U.president), approve(b, rid, U.vp)])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(String((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason)).toMatch(/ALREADY_DECIDED|STATE_NOT_ELIGIBLE/)
      expect(await snapshot(rid)).toEqual({ status: 'satisfied', approvals: 1 })
    }
  })

  it('a delegate and their delegator racing cannot cast two votes for one authority line', async () => {
    const [a, b, c] = await trio()
    const k = kitFor(c)
    await k.grantOffice(U.president, U.vp, U.treasurer).catch(() => undefined)
    const { delegationId } = await run(c, U.president, (t) => issueDelegation(t, k.deps, {
      organizationId: ORG, delegatorUserId: U.president, delegateUserId: U.officer, office: 'President', actions: ['governance:approve'], resourceTypes: ['approval_request'], effectiveAt: minutesAgo(), expiresAt: daysAhead(10) }))
    await run(c, U.officer, (t) => acceptInstrument(t, { organizationId: ORG, instrumentType: 'delegation', instrumentId: delegationId, holderUserId: U.officer }))
    for (let i = 0; i < 15; i++) {
      const rid = await open(c, { requiredApprovals: 3, namedApproverIds: [] })
      const results = await Promise.allSettled([approve(a, rid, U.officer, { delegationId }), approve(b, rid, U.president)])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect((await snapshot(rid)).approvals).toBe(1)
    }
  })

  it('the same person racing against themselves records one vote', async () => {
    const [a, b, c] = await trio()
    for (let i = 0; i < 10; i++) {
      const rid = await open(c, { requiredApprovals: 3 })
      const results = await Promise.allSettled([approve(a, rid, U.president), approve(b, rid, U.president)])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect((await snapshot(rid)).approvals).toBe(1)
    }
  })

  it('two mandates racing on one approval: the approval can back exactly one issuance', async () => {
    const [a, b, c] = await trio()
    const k = kitFor(c)
    for (let i = 0; i < 6; i++) {
      const id = newUuid()
      const input = { organizationId: ORG, issuerUserId: U.president, holderUserId: U.officer, kind: 'supervisory' as const, powers: ['read'], scope: { resourceIds: [CASE_ID] }, effectiveAt: minutesAgo(), expiresAt: daysAhead(10) }
      const req = await run(c, U.president, (t) => requestIssuanceApproval(t, k.deps, { ...input, sourceInstrument: `Res race ${i}-a`, instrumentId: id, namedApproverIds: [U.treasurer] }))
      await run(c, U.treasurer, (t) => recordApprovalDecision(t, k.deps, { organizationId: ORG, approvalRequestId: req, approverUserId: U.treasurer, decision: 'approved' }))
      const results = await Promise.allSettled([
        run(a, U.president, (t) => issueMandate(t, k.deps, { ...input, id, sourceInstrument: `Res race ${i}-a`, approvalRequestId: req })),
        run(b, U.president, (t) => issueMandate(t, k.deps, { ...input, id, sourceInstrument: `Res race ${i}-b`, approvalRequestId: req })),
      ])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    }
  })

  it('duplicate requests racing under one idempotency key run once, audit once, and replay for the rest', async () => {
    const conns = await Promise.all([conn(), conn(), conn(), conn(), conn()])
    const key = `race-key-${Date.now()}`
    const before = await n(`SELECT count(*) n FROM ue_authority_recusals`)
    const resource = newUuid()
    const results = await Promise.allSettled(conns.map((c) => run(c, U.member, (t) => runIdempotent(t,
      { organizationId: ORG, actorUserId: U.member, key, operation: 'recusal.declare', payload: { resource } },
      async () => ({ recusalId: await insertRecusal(t, { organizationId: ORG, principalUserId: U.member, resourceType: 'case', resourceId: resource, reason: 'conflict' }) })))))
    const ok = results.filter((r): r is PromiseFulfilledResult<{ replayed: boolean; result: Record<string, unknown> }> => r.status === 'fulfilled')
    expect(ok).toHaveLength(5)
    expect(ok.filter((r) => !r.value.replayed)).toHaveLength(1)
    expect(new Set(ok.map((r) => JSON.stringify(r.value.result))).size).toBe(1)
    expect(await n(`SELECT count(*) n FROM ue_authority_recusals`)).toBe(before + 1)
  })

  it('crash and retry: a backend killed mid-transaction leaves nothing, and the retry with the same key runs once', async () => {
    const victim = await conn()
    const pid = (await victim.query('SELECT pg_backend_pid() pid')).rows[0].pid as number
    const key = `crash-key-${Date.now()}`
    const resource = newUuid()
    const payload = { resource }
    const before = { rec: await n(`SELECT count(*) n FROM ue_authority_recusals`), aud: await n(`SELECT count(*) n FROM public.audit_logs`), req: await n(`SELECT count(*) n FROM ue_authority_requests`) }
    const attempt = run(victim, U.member, async (t) => {
      await runIdempotent(t, { organizationId: ORG, actorUserId: U.member, key, operation: 'recusal.declare', payload }, async () => ({
        recusalId: await insertRecusal(t, { organizationId: ORG, principalUserId: U.member, resourceType: 'case', resourceId: resource, reason: 'conflict' }) }))
      // The mutation, its event and its canonical audit row exist inside the open transaction; the server dies before COMMIT.
      await admin.query('SELECT pg_terminate_backend($1)', [pid])
      await new Promise((r) => setTimeout(r, 200))
      await t.query('SELECT 1')
    })
    await expect(attempt).rejects.toThrow()
    expect({ rec: await n(`SELECT count(*) n FROM ue_authority_recusals`), aud: await n(`SELECT count(*) n FROM public.audit_logs`), req: await n(`SELECT count(*) n FROM ue_authority_requests`) }).toEqual(before)
    const retry = await conn()
    const r1 = await run(retry, U.member, (t) => runIdempotent(t, { organizationId: ORG, actorUserId: U.member, key, operation: 'recusal.declare', payload },
      async () => ({ recusalId: await insertRecusal(t, { organizationId: ORG, principalUserId: U.member, resourceType: 'case', resourceId: resource, reason: 'conflict' }) })))
    expect(r1.replayed).toBe(false)
    // The client lost the response and retries: replay, no second mutation, no second audit row.
    const r2 = await run(retry, U.member, (t) => runIdempotent(t, { organizationId: ORG, actorUserId: U.member, key, operation: 'recusal.declare', payload }, async () => { throw new Error('must not run twice') }))
    expect(r2.replayed).toBe(true)
    expect(r2.result).toEqual(r1.result)
    expect(await n(`SELECT count(*) n FROM ue_authority_recusals`)).toBe(before.rec + 1)
    expect(await n(`SELECT count(*) n FROM public.audit_logs`)).toBe(before.aud + 1)
  })

  it('concurrent authority writes in one organization keep the canonical chain intact and reconcile cleanly', async () => {
    const conns = await Promise.all(Array.from({ length: 8 }, () => conn()))
    // Concurrency is across connections; each connection runs its own transactions one after another.
    const results = await Promise.allSettled(conns.map(async (c, i) => {
      for (const j of [0, 1, 2]) {
        await run(c, U.member, (t) => declareOwnRecusal(t, { organizationId: ORG, principalUserId: U.member, resourceType: 'case', resourceId: newUuid(), reason: `race ${i}-${j}` }))
      }
    }))
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
    const rows = (await setup.query(`SELECT id::text, action, resource_type, resource_id, user_id, details, content_hash, previous_hash, created_at::text cat FROM public.audit_logs WHERE organization_id = $1 ORDER BY created_at, id`, [ORG])).rows
    let prev: string | null = null
    let idx = 0
    for (const r of rows) {
      if (r.previous_hash !== prev) {
        throw new Error(`chain break at ${idx}/${rows.length}: ${JSON.stringify(rows.slice(Math.max(0, idx - 2), idx + 2).map((x) => ({ id: x.id.slice(0, 8), a: x.action, c: x.cat, p: x.previous_hash?.slice(0, 6), h: x.content_hash.slice(0, 6) })))}`)
      }
      idx++
      expect(r.content_hash).toBe(canonicalAuditContentHash({ action: r.action, resourceType: r.resource_type, resourceId: r.resource_id ?? '', userId: r.user_id ?? '', correlationId: '', details: r.details, previousHash: r.previous_hash }))
      prev = r.content_hash
    }
    const rec = await run(await conn(), U.president, (t) => reconcileAuthorityAudit(t, ORG))
    expect(rec).toEqual({ eventsWithoutAudit: [], auditRowsWithUnknownEvents: [], chainBreaks: [] })
  })

  it('a financial step recorded by two actors at once is recorded once', async () => {
    const PAY = newUuid()
    const ACCT = newUuid()
    await setup.query(`INSERT INTO public.payments (id, organization_id, member_id, amount, currency) VALUES ($1,$2,$3,'10.00','CAD')`, [PAY, ORG, U.member])
    const c = await conn()
    const k = kitFor(c)
    const money = { scope: { accountIds: [ACCT] }, monetaryLimitMinor: 100_000, currency: 'CAD' }
    await k.grantMandate('financial', U.treasurer, ['view', 'prepare'], { ...money, approver: U.vp })
    await k.grantMandate('financial', U.vp, ['approve'], { ...money, issuer: U.president, approver: U.treasurer })
    await k.grantMandate('financial', U.president, ['execute'], { ...money, issuer: U.vp, approver: U.treasurer })
    const step = (cn: pg.Client, who: string, s: 'registered' | 'prepared' | 'approved' | 'executed', extra: Record<string, unknown> = {}) =>
      run(cn, who, (t) => recordFinancialStep(t, k.deps, { organizationId: ORG, actorUserId: who, paymentId: PAY, step: s, ...extra }))
    await step(c, U.treasurer, 'registered', { accountId: ACCT, requiredApprovals: 1 })
    await step(c, U.treasurer, 'prepared')
    await step(c, U.vp, 'approved')
    const [a, b] = [await conn(), await conn()]
    const results = await Promise.allSettled([step(a, U.president, 'executed'), step(b, U.president, 'executed')])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await n(`SELECT count(*) n FROM ue_authority_financial_steps WHERE subject_id = $1 AND step = 'executed'`, [PAY])).toBe(1)
  })

  it('events cannot be forged or removed by the runtime role on a real server', async () => {
    const c = await conn()
    await expect(run(c, U.president, (t) => t.query(`INSERT INTO ue_authority_events (organization_id, source_table, source_id, operation, row_after) VALUES ($1,'ue_authority_mandates',$1,'INSERT','{}')`, [ORG]))).rejects.toThrow(/recording trigger/)
    await expect(run(c, U.president, (t) => t.query(`DELETE FROM ue_authority_events`))).rejects.toThrow(/permission denied/)
    expect(await n(`SELECT count(*) n FROM ue_authority_events`)).toBeGreaterThan(30)
  })
})
