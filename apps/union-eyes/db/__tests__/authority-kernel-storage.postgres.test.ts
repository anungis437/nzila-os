/**
 * Authority kernel storage on REAL PostgreSQL — concurrent-transaction proof.
 *
 * Skipped unless UE_AUTHORITY_PG_URL points at a disposable PostgreSQL server
 * whose user may CREATE DATABASE and CREATE ROLE, e.g.
 *   docker run -d --name ue-authority-pg -e POSTGRES_PASSWORD=pw -p 55434:5432 postgres:16-alpine
 *   UE_AUTHORITY_PG_URL=postgres://postgres:pw@localhost:55434/postgres
 * Each run creates and drops its own database. It never touches existing data.
 *
 * PGlite is single-connection and cannot show lock behaviour; this file proves
 * what the row lock on the approval request and the unique authority line
 * guarantee when two transactions genuinely race. This is not a staging pass.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runAuthorityTransaction, type SqlExecutor } from '../../lib/authority/store/executor'
import type { MembershipSource } from '../../lib/authority/store/facts'
import { grantDelegation, grantMandate, openApprovalRequest, recordApprovalDecision } from '../../lib/authority/store/mutations'

const URL = process.env.UE_AUTHORITY_PG_URL
const APP_ROOT = resolve(__dirname, '..', '..')
const read = (p: string) => readFileSync(resolve(APP_ROOT, p), 'utf8')
const HELPER = read('db/migrations-cache/0010_tenant_isolation_rls_foundation.sql')
  .match(/CREATE OR REPLACE FUNCTION ue_create_direct_org_rls_policy\([\s\S]*?\$\$ LANGUAGE plpgsql;/)?.[0]

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORG = id(0xa)
const U = { p1: id(5), p2: id(6), p3: id(7), delegate: id(13), other: id(9) }
let seq = 5000
const fresh = () => id(seq++)
const DAY = 86_400_000
const past = () => new Date(Date.now() - DAY)
const soon = () => new Date(Date.now() + 7 * DAY)

const membershipSource: MembershipSource = async (_e, org, ids) =>
  ids.map((u) => ({ userId: u, organizationId: org, status: 'active' as const, capacities: ['executive' as const] }))
const deps = { memberships: membershipSource }

describe.skipIf(!URL)('authority storage on real PostgreSQL', () => {
  const dbName = `ue_authority_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  let admin: pg.Client
  const clients: pg.Client[] = []

  async function connection(): Promise<pg.Client> {
    const u = new globalThis.URL(URL!)
    u.pathname = `/${dbName}`
    const c = new pg.Client({ connectionString: u.toString() })
    await c.connect()
    await c.query('SET ROLE union_eyes_runtime')
    clients.push(c)
    return c
  }
  const run = <T>(c: pg.Client, user: string, fn: (t: SqlExecutor) => Promise<T>) =>
    runAuthorityTransaction(c as unknown as SqlExecutor, { organizationId: ORG, userId: user }, fn)

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    await admin.query(`CREATE DATABASE ${dbName}`)
    const u = new globalThis.URL(URL!)
    u.pathname = `/${dbName}`
    const setup = new pg.Client({ connectionString: u.toString() })
    await setup.connect()
    await setup.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_runtime') THEN
          CREATE ROLE union_eyes_runtime NOSUPERUSER NOBYPASSRLS NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_system') THEN
          CREATE ROLE union_eyes_system NOSUPERUSER NOBYPASSRLS NOLOGIN;
        END IF;
      END $$;`)
    await setup.query(HELPER!)
    await setup.query(read('db/migrations-platform/0013_authority_kernel_storage.sql'))
    await setup.query(read('db/migrations-cache/0020_authority_kernel_rls_closure.sql'))
    await setup.query(`GRANT SELECT, INSERT, UPDATE ON ue_authority_mandates, ue_authority_resource_relationships, ue_authority_delegations,
      ue_authority_recusals, ue_authority_disclosure_consents, ue_authority_approval_requests TO union_eyes_runtime`)
    await setup.query(`GRANT SELECT, INSERT ON ue_authority_approval_decisions, ue_authority_events TO union_eyes_runtime`)
    await setup.end()
    // Two executive office-holders who may approve.
    const c = await connection()
    for (const p of [U.p1, U.p2, U.p3]) {
      await run(c, U.other, (t) => grantMandate(t, {
        organizationId: ORG, principalUserId: p, kind: 'executive_office', powers: ['approve'],
        sourceInstrument: `Bylaw 7.2 office ${p}`, grantedBy: U.other, effectiveAt: past(), expiresAt: soon(),
      }))
    }
  })

  afterAll(async () => {
    for (const c of clients) await c.end().catch(() => undefined)
    await admin?.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`)
    await admin?.end()
  })

  const open = async (c: pg.Client, over: Partial<Parameters<typeof openApprovalRequest>[1]> = {}) =>
    run(c, U.other, (t) => openApprovalRequest(t, {
      organizationId: ORG, subjectType: 'bylaw_amendment', subjectId: fresh(), proposedBy: U.other, requiredApprovals: 2, riskClass: 'medium', ...over,
    }))
  const snapshot = async (c: pg.Client, rid: string) => {
    const r = await run(c, U.other, (t) => t.query<{ status: string; n: string }>(
      `SELECT r.status, (SELECT count(*)::text FROM ue_authority_approval_decisions d WHERE d.approval_request_id = r.id AND d.decision = 'approved') n
       FROM ue_authority_approval_requests r WHERE r.id = $1`, [rid]))
    return { status: r.rows[0].status, approvals: Number(r.rows[0].n) }
  }
  const approve = (c: pg.Client, rid: string, who: string, extra: Record<string, unknown> = {}) =>
    run(c, who, (t) => recordApprovalDecision(t, deps, { organizationId: ORG, approvalRequestId: rid, approverUserId: who, decision: 'approved', ...extra }))

  it('two approvers racing on a 2-approval request both land and the request resolves to satisfied exactly once', async () => {
    const [a, b, c] = [await connection(), await connection(), await connection()]
    for (let i = 0; i < 15; i++) {
      const rid = await open(c)
      const results = await Promise.allSettled([approve(a, rid, U.p1), approve(b, rid, U.p2)])
      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled'])
      expect(await snapshot(c, rid)).toEqual({ status: 'satisfied', approvals: 2 })
    }
  })

  it('two approvers racing on a 1-approval request: exactly one decision is recorded, the other is refused', async () => {
    const [a, b, c] = [await connection(), await connection(), await connection()]
    for (let i = 0; i < 15; i++) {
      const rid = await open(c, { requiredApprovals: 1 })
      const results = await Promise.allSettled([approve(a, rid, U.p1), approve(b, rid, U.p2)])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
      expect(String(rejected.reason)).toMatch(/ALREADY_DECIDED|STATE_NOT_ELIGIBLE/)
      expect(await snapshot(c, rid)).toEqual({ status: 'satisfied', approvals: 1 })
    }
  })

  it('a delegate and their delegator racing cannot cast two votes for one authority line', async () => {
    const [a, b, c] = [await connection(), await connection(), await connection()]
    const did = await run(c, U.other, (t) => grantDelegation(t, {
      organizationId: ORG, delegatorUserId: U.p1, delegateUserId: U.delegate, office: 'President',
      actions: ['governance:approve'], resourceTypes: ['approval_request'], effectiveAt: past(), expiresAt: soon(),
    }))
    for (let i = 0; i < 15; i++) {
      const rid = await open(c, { requiredApprovals: 3 })
      const results = await Promise.allSettled([approve(a, rid, U.delegate, { delegationId: did }), approve(b, rid, U.p1)])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect((await snapshot(c, rid)).approvals).toBe(1)
    }
  })

  it('the same person racing against themselves records one vote', async () => {
    const [a, b, c] = [await connection(), await connection(), await connection()]
    for (let i = 0; i < 10; i++) {
      const rid = await open(c, { requiredApprovals: 3 })
      const results = await Promise.allSettled([approve(a, rid, U.p1), approve(b, rid, U.p1)])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect((await snapshot(c, rid)).approvals).toBe(1)
    }
  })

  it('a failed transaction leaves no mutation and no event on a real server', async () => {
    const c = await connection()
    let rid = ''
    await expect(run(c, U.other, async (t) => {
      rid = await openApprovalRequest(t, { organizationId: ORG, subjectType: 'x', subjectId: fresh(), proposedBy: U.other, requiredApprovals: 1, riskClass: 'low' })
      throw new Error('boom')
    })).rejects.toThrow(/boom/)
    const rows = await run(c, U.other, (t) => t.query(`SELECT 1 FROM ue_authority_events WHERE source_id = $1`, [rid]))
    expect(rows.rows).toHaveLength(0)
  })

  it('every authority mutation above produced events, and none can be forged or removed as the runtime role', async () => {
    const c = await connection()
    const n = await run(c, U.other, (t) => t.query<{ n: string }>(`SELECT count(*)::text n FROM ue_authority_events`))
    expect(Number(n.rows[0].n)).toBeGreaterThan(30)
    await expect(run(c, U.other, (t) => t.query(`INSERT INTO ue_authority_events (organization_id, source_table, source_id, operation, row_after) VALUES ($1,'ue_authority_mandates',$1,'INSERT','{}')`, [ORG]))).rejects.toThrow(/recording trigger/)
    await expect(run(c, U.other, (t) => t.query(`DELETE FROM ue_authority_events`))).rejects.toThrow(/permission denied/)
  })
})
