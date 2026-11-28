/**
 * Representation workflow storage (platform 0091, RLS scoped 0064) on real PostgreSQL, as the tenant runtime role.
 *
 * What it holds, under FORCE row-level security:
 *   - both tables force RLS with tenant policies;
 *   - an organization records and reads its own participants and records and sees none of another organization's;
 *   - a row naming another organization, or another organization's grievance, is refused;
 *   - a participant row changes once (withdrawal) and never otherwise; representation records are append-only.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql, type SQL } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { nativeActionUrl, installNativeBusinessContext, withNativeCanonicalActor } from '../../scripts/runtime/native-canonical-fixture'
import { seedMembership, type Db } from './authority-kernel-harness'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const TABLES = ['grievance_group_participants', 'grievance_representation_records']

describe.skipIf(!URL)('representation workflow storage under FORCE RLS, as the runtime role', () => {
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const actor = (org: string) => `representation-actor-${org}`
  let admin: pg.Client
  let client: ReturnType<typeof postgres>
  let db: ReturnType<typeof drizzle>
  const grievance: Record<string, string> = {}

  type Tx = { execute: (query: SQL) => Promise<unknown> }
  const rows = async <T>(tx: Tx, query: SQL) => {
    const result = (await tx.execute(query)) as unknown
    return (Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])) as T[]
  }
  async function asRuntime<T>(organizationId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
    return withNativeCanonicalActor(actor(organizationId), organizationId, (binding) =>
      db.transaction(async (tx) => {
        await tx.execute(sql.raw('SET LOCAL ROLE union_eyes_runtime'))
        await installNativeBusinessContext((statement) => tx.execute(statement), binding)
        return work(tx as unknown as Tx)
      }),
    )
  }
  const participant = (org: string, grievanceId: string, member: string) => sql`INSERT INTO grievance_group_participants
    (organization_id, grievance_id, member_user_id, employer_portion_ref, consent_form, consent_evidence_ref, consented_at, recorded_by)
    VALUES (${org}::uuid, ${grievanceId}::uuid, ${member}, 'portion-north', 'written_signature', 'doc-1', now(), ${actor(org)}) RETURNING id::text`

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    client = postgres(nativeActionUrl('union_eyes_runtime', URL), { max: 2, onnotice: () => undefined })
    db = drizzle(client)
    const sfx = randomUUID().slice(0, 8)
    for (const org of [ORG_A, ORG_B]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [org, `Representation Fixture ${org.slice(0, 6)}`, `representation-${sfx}-${org.slice(0, 6)}`],
      )
      const seed: Db = { exec: (text) => admin.query(text), query: (text, params) => admin.query(text, params) }
      await seedMembership(seed, actor(org), org, 'officer')
      grievance[org] = randomUUID()
      await admin.query(
        `INSERT INTO grievances (id, organization_id, grievance_number, type, title, description, created_by) VALUES ($1,$2,$3,'group','Synthetic group grievance','d',$4)`,
        [grievance[org], org, `GR-REP-${org.slice(0, 8)}`, actor(org)],
      )
    }
    await admin.query(
      `INSERT INTO grievance_representation_records (organization_id, grievance_id, record_kind, payload, recorded_by) VALUES ($1,$2,'abandonment','{}'::jsonb,'seed')`,
      [ORG_B, grievance[ORG_B]],
    )
  }, 120_000)

  afterAll(async () => {
    await client?.end({ timeout: 5 }).catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  it('forces row-level security with tenant policies on both tables', async () => {
    const forced = await admin.query(
      `SELECT c.relname, c.relforcerowsecurity, (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)::int AS policies
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY($1)`,
      [TABLES],
    )
    expect(forced.rows).toHaveLength(2)
    for (const row of forced.rows) {
      expect(row.relforcerowsecurity, row.relname).toBe(true)
      expect(row.policies, row.relname).toBeGreaterThan(0)
    }
  })

  it('records its own participant and record, and reads none of the other organization', async () => {
    const [p] = await asRuntime(ORG_A, (tx) => rows<{ id: string }>(tx, participant(ORG_A, grievance[ORG_A], 'm1')))
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/)
    await asRuntime(ORG_A, (tx) =>
      tx.execute(sql`INSERT INTO grievance_representation_records (organization_id, grievance_id, record_kind, payload, recorded_by)
        VALUES (${ORG_A}::uuid, ${grievance[ORG_A]}::uuid, 'employer_initiated_filing', '{"employerCaseRef":"EMP-1"}'::jsonb, ${actor(ORG_A)})`),
    )
    const seen = await asRuntime(ORG_A, (tx) => rows<{ organization_id: string }>(tx, sql`SELECT organization_id::text FROM grievance_representation_records`))
    expect(seen.map((r) => r.organization_id)).toEqual([ORG_A])
    const named = await asRuntime(ORG_A, (tx) => rows(tx, sql`SELECT 1 FROM grievance_representation_records WHERE organization_id = ${ORG_B}::uuid`))
    expect(named).toEqual([])
  })

  it('refuses a row naming another organization or pointing at its grievance', async () => {
    await expect(asRuntime(ORG_A, (tx) => tx.execute(participant(ORG_B, grievance[ORG_B], 'm2')))).rejects.toThrow()
    await expect(asRuntime(ORG_A, (tx) => tx.execute(participant(ORG_A, grievance[ORG_B], 'm2')))).rejects.toThrow()
    expect((await admin.query(`SELECT 1 FROM grievance_group_participants WHERE grievance_id = $1`, [grievance[ORG_B]])).rows).toEqual([])
  })

  it('a participant is withdrawn once and never rewritten; records are append-only', async () => {
    await asRuntime(ORG_A, (tx) =>
      tx.execute(sql`UPDATE grievance_group_participants SET withdrawn_at = now(), withdrawn_recorded_by = ${actor(ORG_A)}, withdrawal_reason = 'member asked'
        WHERE organization_id = ${ORG_A}::uuid AND withdrawn_at IS NULL`),
    )
    await expect(
      asRuntime(ORG_A, (tx) => tx.execute(sql`UPDATE grievance_group_participants SET consent_evidence_ref = 'x' WHERE organization_id = ${ORG_A}::uuid`)),
    ).rejects.toThrow()
    await expect(admin.query(`UPDATE grievance_representation_records SET payload = '{}'::jsonb WHERE organization_id = $1`, [ORG_A])).rejects.toThrow(/append-only/)
    await expect(admin.query(`DELETE FROM grievance_representation_records WHERE organization_id = $1`, [ORG_A])).rejects.toThrow(/append-only/)
  })
})
