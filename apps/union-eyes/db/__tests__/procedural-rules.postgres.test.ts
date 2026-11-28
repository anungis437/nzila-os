/**
 * Procedural rule storage (platform 0090, RLS scoped 0063) on real PostgreSQL, as the tenant runtime role.
 *
 * What it holds, over the real tables under FORCE row-level security:
 *   - every procedural table forces RLS and carries the direct-organization policies;
 *   - an organization reads and writes its own rule sources, rule sets, calendars, bindings, facts and exceptions, and sees none
 *     of another organization's (also when the query names the other organization);
 *   - a write naming another organization is refused, and an update of another organization's row changes nothing;
 *   - a grievance-scoped row cannot point at another organization's grievance;
 *   - lifecycle guards hold natively: content frozen once reviewed, illegal status moves and deletes refused, lifecycle events
 *     append-only.
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

const TABLES = [
  'procedural_rule_sources',
  'procedural_rule_sets',
  'procedural_holiday_calendars',
  'procedural_rule_lifecycle_events',
  'grievance_procedure_bindings',
  'grievance_procedural_facts',
  'grievance_procedural_exceptions',
]

const DIGEST = 'a'.repeat(64)

describe.skipIf(!URL)('procedural rule storage under FORCE RLS, as the runtime role', () => {
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const actor = (org: string) => `procedural-actor-${org}`
  let admin: pg.Client
  let client: ReturnType<typeof postgres>
  let db: ReturnType<typeof drizzle>
  const grievance: Record<string, string> = {}
  const sourceOf: Record<string, string> = {}

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
        [org, `Procedural Fixture ${org.slice(0, 6)}`, `procedural-${sfx}-${org.slice(0, 6)}`],
      )
      const seed: Db = { exec: (text) => admin.query(text), query: (text, params) => admin.query(text, params) }
      await seedMembership(seed, actor(org), org, 'officer')
      grievance[org] = randomUUID()
      await admin.query(
        `INSERT INTO grievances (id, organization_id, grievance_number, type, title, description, created_by) VALUES ($1,$2,$3,'individual','Synthetic grievance','d',$4)`,
        [grievance[org], org, `GR-PROC-${org.slice(0, 8)}`, actor(org)],
      )
      const src = await admin.query(
        `INSERT INTO procedural_rule_sources (organization_id, source_kind, title, edition, language, reference, effective_from, created_by)
         VALUES ($1,'collective_agreement','Synthetic Agreement','2026-2029','en','Art. 18 (invented)','2026-01-01','seed') RETURNING id`,
        [org],
      )
      sourceOf[org] = src.rows[0].id
      await admin.query(
        `INSERT INTO procedural_rule_sets (organization_id, rule_key, version, origin, source_id, regime, procedure_route, applicability, effective_from, definition, content_digest, drafted_by)
         VALUES ($1,'synthetic/standard',1,'human_authored',$2,'synthetic','individual','{}'::jsonb,'2026-01-01','{}'::jsonb,$3,'seed-drafter')`,
        [org, sourceOf[org], DIGEST],
      )
    }
  }, 120_000)

  afterAll(async () => {
    await client?.end({ timeout: 5 }).catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  it('forces row-level security on every procedural table, with tenant policies for the runtime role', async () => {
    const forced = await admin.query(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
              (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)::int AS policies
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = ANY($1) ORDER BY c.relname`,
      [TABLES],
    )
    expect(forced.rows.map((r) => r.relname).sort()).toEqual([...TABLES].sort())
    for (const row of forced.rows) {
      expect(row.relrowsecurity, row.relname).toBe(true)
      expect(row.relforcerowsecurity, row.relname).toBe(true)
      expect(row.policies, row.relname).toBeGreaterThan(0)
    }
  })

  it('reads only its own organization, also when the query names the other organization', async () => {
    const own = await asRuntime(ORG_A, (tx) => rows<{ organization_id: string }>(tx, sql`SELECT organization_id::text FROM procedural_rule_sets`))
    expect(own.map((r) => r.organization_id)).toEqual([ORG_A])
    const named = await asRuntime(ORG_A, (tx) => rows(tx, sql`SELECT 1 FROM procedural_rule_sources WHERE organization_id = ${ORG_B}::uuid`))
    expect(named).toEqual([])
  })

  it('writes its own rows through the runtime grants', async () => {
    const created = await asRuntime(ORG_A, async (tx) => {
      const [binding] = await rows<{ id: string }>(tx, sql`INSERT INTO grievance_procedure_bindings (organization_id, grievance_id, regime, procedure_route, reference_day, recorded_by)
        VALUES (${ORG_A}::uuid, ${grievance[ORG_A]}::uuid, 'synthetic', 'individual', '2027-03-01', ${actor(ORG_A)}) RETURNING id::text`)
      await tx.execute(sql`INSERT INTO grievance_procedural_facts (organization_id, grievance_id, fact_kind, payload, recorded_by)
        VALUES (${ORG_A}::uuid, ${grievance[ORG_A]}::uuid, 'trigger', '{"event":"presentation","receivedAt":"2027-03-01T15:00:00Z"}'::jsonb, ${actor(ORG_A)})`)
      await tx.execute(sql`INSERT INTO grievance_procedural_exceptions (organization_id, grievance_id, clock_key, codes, evidence, evidence_digest, raised_by)
        VALUES (${ORG_A}::uuid, ${grievance[ORG_A]}::uuid, 'reply_l1', '{rule_set_not_adopted}', '{}'::jsonb, ${DIGEST}, ${actor(ORG_A)})`)
      return binding
    })
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('refuses a write naming another organization, and an update of its rows changes nothing', async () => {
    await expect(
      asRuntime(ORG_A, (tx) =>
        tx.execute(sql`INSERT INTO procedural_rule_sources (organization_id, source_kind, title, edition, language, reference, effective_from, created_by)
          VALUES (${ORG_B}::uuid, 'statute', 'x', 'x', 'en', 'x', '2026-01-01', 'x')`),
      ),
    ).rejects.toThrow()
    const touched = await asRuntime(ORG_A, (tx) =>
      rows(tx, sql`UPDATE procedural_rule_sets SET status = 'retired', closed_by = 'x', closed_at = now() WHERE organization_id = ${ORG_B}::uuid RETURNING id`),
    )
    expect(touched).toEqual([])
    const after = await admin.query(`SELECT status FROM procedural_rule_sets WHERE organization_id = $1`, [ORG_B])
    expect(after.rows).toEqual([{ status: 'draft' }])
  })

  it("refuses a grievance-scoped row that points at another organization's grievance", async () => {
    await expect(
      asRuntime(ORG_A, (tx) =>
        tx.execute(sql`INSERT INTO grievance_procedural_facts (organization_id, grievance_id, fact_kind, payload, recorded_by)
          VALUES (${ORG_A}::uuid, ${grievance[ORG_B]}::uuid, 'trigger', '{}'::jsonb, 'x')`),
      ),
    ).rejects.toThrow()
    const leaked = await admin.query(`SELECT 1 FROM grievance_procedural_facts WHERE grievance_id = $1`, [grievance[ORG_B]])
    expect(leaked.rows).toEqual([])
  })

  it('holds the lifecycle guards natively: frozen content, legal moves only, no deletes, append-only events', async () => {
    const [{ id }] = (await admin.query(`SELECT id FROM procedural_rule_sets WHERE organization_id = $1`, [ORG_A])).rows
    await expect(admin.query(`UPDATE procedural_rule_sets SET status = 'adopted', adopted_by = 'a', adopted_at = now() WHERE id = $1`, [id])).rejects.toThrow()
    await expect(admin.query(`UPDATE procedural_rule_sets SET status = 'reviewed', reviewed_by = 'seed-drafter', reviewed_at = now() WHERE id = $1`, [id])).rejects.toThrow(/independent_review/)
    await admin.query(`UPDATE procedural_rule_sets SET status = 'reviewed', reviewed_by = 'reviewer', reviewed_at = now() WHERE id = $1`, [id])
    await expect(admin.query(`UPDATE procedural_rule_sets SET definition = '{"changed":true}'::jsonb WHERE id = $1`, [id])).rejects.toThrow(/frozen/)
    await expect(admin.query(`DELETE FROM procedural_rule_sets WHERE id = $1`, [id])).rejects.toThrow(/append-only/)
    await admin.query(`INSERT INTO procedural_rule_lifecycle_events (organization_id, subject_type, subject_id, to_status, actor_id) VALUES ($1,'rule_set',$2,'reviewed','reviewer')`, [ORG_A, id])
    await expect(admin.query(`UPDATE procedural_rule_lifecycle_events SET reason = 'x' WHERE subject_id = $1`, [id])).rejects.toThrow(/append-only/)
  })

  it('lets the runtime role void a fact once and never rewrite it', async () => {
    await asRuntime(ORG_A, (tx) =>
      tx.execute(sql`UPDATE grievance_procedural_facts SET voided_by = ${actor(ORG_A)}, voided_at = now(), void_reason = 'entered twice' WHERE organization_id = ${ORG_A}::uuid`),
    )
    await expect(
      asRuntime(ORG_A, (tx) => tx.execute(sql`UPDATE grievance_procedural_facts SET payload = '{}'::jsonb WHERE organization_id = ${ORG_A}::uuid`)),
    ).rejects.toThrow()
  })
})
