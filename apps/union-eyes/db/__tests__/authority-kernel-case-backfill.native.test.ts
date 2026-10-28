/**
 * Native proof that two ownership backfills for one organization cannot both assign.
 *
 * Cursor does not set UE_OWNERSHIP_NATIVE_PROOF and does not start Docker.
 * A skipped run is not evidence. Status stays READY_FOR_VS_EXECUTION.
 * The fixture is synthetic. This file does not execute a protected institutional backfill.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { executeOwnershipBackfill, planOwnershipBackfill } from '../../lib/authority/store/case-ownership-backfill'
import { canonicalMembershipSource } from '../../lib/authority/store/identity'
import { runAuthorityTransaction, type SqlExecutor } from '../../lib/authority/store/executor'
import { installAuthoritySchema, newUuid, ORG, seedCast, seedMembership, U, type Db } from './authority-kernel-harness'
import { kit } from './authority-kernel-testkit'

const native = process.env.UE_OWNERSHIP_NATIVE_PROOF === '1' ? describe : describe.skip

native('ownership backfill concurrency on disposable PostgreSQL', () => {
  const image = 'pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337'
  const name = `ue-ownership-backfill-${process.pid}-${Date.now()}`
  let created = false
  let config: pg.ClientConfig
  let admin: pg.Client
  const CASE_A = newUuid()
  const CASE_B = newUuid()
  // grievances.union_rep_id is a uuid column, so the legacy owners of this fixture are uuid principals.
  const REP_A = newUuid()
  const REP_B = newUuid()

  function asDb(client: pg.Client): Db {
    return {
      exec: (sql) => client.query(sql),
      query: (sql, params) => client.query(sql, params),
    }
  }

  beforeAll(async () => {
    execFileSync('docker', ['run', '--detach', '--name', name, '-e', 'POSTGRES_PASSWORD=synthetic-only', '-p', '127.0.0.1::5432', image], { stdio: 'pipe' })
    created = true
    const ports = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', name], { encoding: 'utf8' }))
    const port = Number(ports['5432/tcp'][0].HostPort)
    config = { host: '127.0.0.1', port, user: 'postgres', password: 'synthetic-only', database: 'postgres' }
    // The image starts a throwaway server to run initdb, stops it, then starts the real one: a connection made between
    // those two terminates. The real server is up once its readiness line has been logged twice.
    for (let attempt = 0; ; attempt += 1) {
      const logged = spawnSync('docker', ['logs', name], { encoding: 'utf8' })
      const logs = `${logged.stdout}${logged.stderr}`
      if ((logs.match(/database system is ready to accept connections/g) ?? []).length >= 2) break
      if (attempt > 120) throw new Error('disposable PostgreSQL did not become ready')
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    admin = new pg.Client(config)
    await admin.connect()
    const db = asDb(admin)
    await installAuthoritySchema(db)
    await seedCast(db)
    await admin.query('SET ROLE union_eyes_runtime')
    const k = kit(db)
    await k.asAdmin(async () => {
      await seedMembership(db, REP_A, ORG, 'steward')
      await seedMembership(db, REP_B, ORG, 'steward')
      await db.query(`INSERT INTO public.grievances (id, organization_id, created_by, union_rep_id) VALUES ($1,$2,$3,$4)`, [CASE_A, ORG, U.member, REP_A])
      await db.query(`INSERT INTO public.grievances (id, organization_id, created_by, union_rep_id) VALUES ($1,$2,$3,$4)`, [CASE_B, ORG, U.member, REP_B])
    })
    await k.adoptDefaultRules()
    await k.grantMandate('supervisory', U.officer, ['read', 'assign'], { scope: { resourceIds: [CASE_A, CASE_B] } })
  }, 180_000)

  afterAll(async () => {
    await admin?.end().catch(() => undefined)
    if (created) execFileSync('docker', ['rm', '--force', name], { stdio: 'pipe' })
  })

  async function executeApproved(approved: { planHash: string; sourceRevision: string }) {
    const client = new pg.Client(config)
    await client.connect()
    try {
      await client.query('SET ROLE union_eyes_runtime')
      const exec: SqlExecutor = { query: (text, params) => client.query(text, params) }
      return await runAuthorityTransaction(exec, { organizationId: ORG, userId: U.officer }, (tx) =>
        executeOwnershipBackfill(tx, { memberships: canonicalMembershipSource }, {
          organizationId: ORG,
          issuerUserId: U.officer,
          approvedPlanHash: approved.planHash,
          approvedSourceRevision: approved.sourceRevision,
          decisionReference: 'native minute 14',
          effectiveAt: new Date(Date.now() - 60_000),
        }),
      )
    } finally {
      await client.end()
    }
  }

  it('lets one concurrent execution assign and the other replay the same receipt', async () => {
    const approved = await runAuthorityTransaction(
      { query: (text, params) => admin.query(text, params) },
      { organizationId: ORG, userId: U.officer },
      (tx) => planOwnershipBackfill(tx, canonicalMembershipSource, ORG),
    )
    const [first, second] = await Promise.allSettled([executeApproved(approved), executeApproved(approved)])
    const ok = [first, second].flatMap((item) => (item.status === 'fulfilled' ? [item.value] : []))
    expect(ok.length).toBe(2)
    expect(ok.filter((item) => item.replayed).length).toBe(1)
    expect(ok.every((item) => item.assigned.length === 2)).toBe(true)
    await admin.query('RESET ROLE')
    const live = await admin.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM ue_authority_resource_relationships WHERE relation = 'assignee' AND revoked_at IS NULL`,
    )
    expect(Number(live.rows[0].n)).toBe(2)
    const replay = await executeApproved(approved)
    expect(replay.replayed).toBe(true)
    const after = await admin.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM ue_authority_resource_relationships WHERE relation = 'assignee' AND revoked_at IS NULL`,
    )
    expect(Number(after.rows[0].n)).toBe(2)
  })
})
