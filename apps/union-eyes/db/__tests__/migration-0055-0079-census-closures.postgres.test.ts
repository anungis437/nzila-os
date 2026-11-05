/**
 * Cache migration 0055 and platform migration 0079 on real PostgreSQL, and the privileges the tenant-context census (CTX-3) declared, as the real roles.
 *
 * 0055 gives row-level security to the relations the census found live code for: job_classifications (direct organization, the administrator members page),
 * committee_memberships and integration_sync_logs (owned through their parent's organization) and shopify_config (system only: the Shopify webhook resolves a shop's
 * organization as the system role). 0079 makes deadline_reminders_pending_uidx the partial unique index over pending reminders that the deadline scheduler relies on:
 * the lineage made it unique over every status, so a reschedule that reused an offset inserted no reminder (the staging proof scenario "reschedule" showed it).
 * This proves that
 *   - each relation has forced row-level security and exactly the policies its class needs (a direct-organization relation: one per command and the system role's; a
 *     parent-owned relation: one runtime policy through the parent and the system role's; a system-only relation: the system role's alone);
 *   - the runtime role sees and writes only its own organization's rows (and is refused a row it names for another one), and reads a parent-owned row only through the
 *     parent's organization;
 *   - the migration is reversible and re-appliable: the rollback removes the policies and the row security, applying again restores the same shape;
 *   - the pending index is partial, a cancelled reminder no longer keeps the key (the same offset can be scheduled again), two pending reminders still cannot share one,
 *     and the rollback refuses while a cancelled and a pending reminder share a key and restores the all-status index when they do not;
 *   - what the manifest declares for the tables this task changed is what the roles hold: the system role reads and writes what the cross-organization jobs need and
 *     deletes nothing but the delivery markers of in_app_notifications, and the runtime role holds what the corrected routes need.
 *
 * Needs UE_AUTHORITY_COMBINED_URL (an ADMIN connection to a disposable, fully bootstrapped database); it fails, it does not skip, without it.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const APP_ROOT = join(__dirname, '..', '..')
const RUNTIME = 'union_eyes_runtime'
const SYSTEM = 'union_eyes_system'

const statementsOf = (file: string, directory: 'migrations-platform' | 'migrations-cache') =>
  readFileSync(join(APP_ROOT, 'db', directory, file), 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean)

type Row = Record<string, any>

describe('cache 0055, platform 0079 and the declared privileges, on real PostgreSQL', () => {
  const tag = randomUUID().slice(0, 8)
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  let admin: pg.Client

  const rows = async (query: string, params: unknown[] = []) => (await admin.query(query, params)).rows as Row[]
  const run = async (statements: string[]) => {
    for (const statement of statements) await admin.query(statement)
  }
  /** One statement as a real role in an organization, in a transaction that is rolled back; resolves to the rows, or to the SQLSTATE the database refused it with. */
  const as = async (role: string, organizationId: string | null, statement: string, params: unknown[] = []): Promise<{ rows?: Row[]; code?: string }> => {
    await admin.query('BEGIN')
    try {
      await admin.query(`SET LOCAL ROLE ${role}`)
      await admin.query(`SELECT set_config('app.current_org_id', $1, true)`, [organizationId ?? ''])
      return { rows: (await admin.query(statement, params)).rows as Row[] }
    } catch (error) {
      return { code: (error as { code?: string }).code }
    } finally {
      await admin.query('ROLLBACK')
    }
  }
  const privileges = async (role: string, table: string) =>
    (await Promise.all(['SELECT', 'INSERT', 'UPDATE', 'DELETE'].map(async (operation) => [operation, (await rows(`SELECT has_table_privilege($1, $2, $3) AS held`, [role, `public.${table}`, operation]))[0].held]))).filter(([, held]) => held).map(([operation]) => operation as string)
  const shapeOf = async (tables: string[]) =>
    rows(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, COALESCE((SELECT array_agg(p.polname::text ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid = c.oid), '{}'::text[]) AS policies
         FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY($1) ORDER BY c.relname`,
      [tables],
    )

  const TABLES_0055 = ['committee_memberships', 'integration_sync_logs', 'job_classifications', 'shopify_config']

  beforeAll(async () => {
    if (!URL) throw new Error('UE_AUTHORITY_COMBINED_URL is required: this proof runs on a native PostgreSQL database')
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    for (const [id, name] of [[ORG_A, 'A'], [ORG_B, 'B']] as const) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1, $2, $3, 'local', '{}', 0, '{}', false, 0, 0, '{}', '{}', 'active', now(), now(), 1)`,
        [id, `Org ${name} ${tag}`, `m0055-${name.toLowerCase()}-${tag}`],
      )
    }
  }, 120_000)

  afterAll(async () => {
    await admin?.end()
  })

  describe('cache 0055', () => {
    const SHAPE = [
      { relname: 'committee_memberships', relrowsecurity: true, relforcerowsecurity: true, policies: ['ue_parent_org_isolation_v2', 'ue_system_full_access'] },
      { relname: 'integration_sync_logs', relrowsecurity: true, relforcerowsecurity: true, policies: ['ue_parent_org_isolation_v2', 'ue_system_full_access'] },
      { relname: 'job_classifications', relrowsecurity: true, relforcerowsecurity: true, policies: ['ue_org_isolation_delete', 'ue_org_isolation_insert', 'ue_org_isolation_select', 'ue_org_isolation_update', 'ue_system_full_access'] },
      { relname: 'shopify_config', relrowsecurity: true, relforcerowsecurity: true, policies: ['ue_system_full_access'] },
    ]
    let classification: string
    let committeeA: string
    let committeeB: string
    let integrationA: string

    beforeAll(async () => {
      classification = (await rows(`INSERT INTO job_classifications (organization_id, job_title, job_code) VALUES ($1, 'Welder A', 'A-1'), ($2, 'Welder B', 'B-1') RETURNING id::text AS id`, [ORG_A, ORG_B]))[0].id
      committeeA = (await rows(`INSERT INTO committees (organization_id, name, committee_type) VALUES ($1, 'Committee A', 'bargaining') RETURNING id::text AS id`, [ORG_A]))[0].id
      committeeB = (await rows(`INSERT INTO committees (organization_id, name, committee_type) VALUES ($1, 'Committee B', 'bargaining') RETURNING id::text AS id`, [ORG_B]))[0].id
      await admin.query(`INSERT INTO committee_memberships (committee_id, member_id, start_date) VALUES ($1, 'a', current_date), ($2, 'b', current_date)`, [committeeA, committeeB])
      integrationA = (await rows(`INSERT INTO api_integrations (organization_id, name, integration_type, connection_type, created_by, field_mapping) VALUES ($1, 'A', 'hris', 'api', 'seed', '{}'::jsonb) RETURNING id::text AS id`, [ORG_A]))[0].id
      const integrationB = (await rows(`INSERT INTO api_integrations (organization_id, name, integration_type, connection_type, created_by, field_mapping) VALUES ($1, 'B', 'hris', 'api', 'seed', '{}'::jsonb) RETURNING id::text AS id`, [ORG_B]))[0].id
      await admin.query(`INSERT INTO integration_sync_logs (integration_id, sync_type, direction, status) VALUES ($1, 'manual', 'inbound', 'success'), ($2, 'manual', 'inbound', 'success')`, [integrationA, integrationB])
      await admin.query(`INSERT INTO shopify_config (org_id, shop_domain, storefront_token_secret_ref, webhook_secret_ref) VALUES ($1, $2, 'r', 'r')`, [ORG_A, `s-${tag}.myshopify.com`])
    })

    it('has forced row-level security and exactly the policies each relation\'s class needs', async () => {
      expect(await shapeOf(TABLES_0055)).toEqual(SHAPE)
    })

    it('shows the runtime role only its own organization\'s rows, directly (job_classifications) and through the parent (the two parent-owned relations)', async () => {
      const count = async (organizationId: string, table: string) => Number((await as(RUNTIME, organizationId, `SELECT count(*)::int AS n FROM ${table}`)).rows![0].n)

      expect([await count(ORG_A, 'job_classifications'), await count(ORG_B, 'job_classifications')]).toEqual([1, 1])
      expect([await count(ORG_A, 'committee_memberships'), await count(ORG_B, 'committee_memberships')]).toEqual([1, 1])
      expect([await count(ORG_A, 'integration_sync_logs'), await count(ORG_B, 'integration_sync_logs')]).toEqual([1, 1])
      expect(await count(randomUUID(), 'job_classifications')).toBe(0)
      expect(await count(randomUUID(), 'committee_memberships')).toBe(0)
      expect((await as(RUNTIME, null, `SELECT count(*)::int AS n FROM integration_sync_logs`)).rows![0].n).toBe(0)
    })

    it('refuses the runtime role a job classification it names for another organization, and changes nothing of another organization\'s', async () => {
      expect((await as(RUNTIME, ORG_A, `INSERT INTO job_classifications (organization_id, job_title, job_code) VALUES ($1, 'Smuggled', 'X')`, [ORG_B])).code).toBe('42501')
      expect((await as(RUNTIME, ORG_A, `UPDATE job_classifications SET job_title = 'Changed' WHERE organization_id = $1 RETURNING id`, [ORG_B])).rows).toEqual([])
      expect((await as(RUNTIME, ORG_A, `UPDATE job_classifications SET job_title = 'Changed' WHERE id = $1 RETURNING job_title`, [classification])).rows).toEqual([{ job_title: 'Changed' }])
      expect((await as(RUNTIME, ORG_A, `DELETE FROM job_classifications WHERE id = $1`, [classification])).code).toBe('42501')
    })

    it('lets the system role read the shop configuration and refuses the runtime role and every write', async () => {
      expect((await as(SYSTEM, null, `SELECT org_id::text AS org FROM shopify_config WHERE lower(shop_domain) = $1`, [`s-${tag}.myshopify.com`])).rows).toEqual([{ org: ORG_A }])
      expect((await as(RUNTIME, ORG_A, `SELECT 1 FROM shopify_config`)).code).toBe('42501')
      expect((await as(SYSTEM, null, `UPDATE shopify_config SET shop_domain = 'x.myshopify.com'`)).code).toBe('42501')
      expect((await as(SYSTEM, null, `DELETE FROM shopify_config`)).code).toBe('42501')
    })

    it('rolls back to relations without row security and applies again to the same shape', async () => {
      await run(statementsOf('0055_census_ctx3_promoted_relations_rls_closure.rollback.sql', 'migrations-cache'))
      expect(await shapeOf(TABLES_0055)).toEqual(SHAPE.map((entry) => ({ ...entry, relrowsecurity: false, relforcerowsecurity: false, policies: [] })))

      await run(statementsOf('0055_census_ctx3_promoted_relations_rls_closure.sql', 'migrations-cache'))
      expect(await shapeOf(TABLES_0055)).toEqual(SHAPE)
    })

    it('refuses to apply when a relation it closes is missing', async () => {
      await admin.query('BEGIN')
      try {
        await admin.query('ALTER TABLE public.shopify_config RENAME TO shopify_config_gone')
        await expect(run(statementsOf('0055_census_ctx3_promoted_relations_rls_closure.sql', 'migrations-cache'))).rejects.toThrow(/public\.shopify_config does not exist/)
      } finally {
        await admin.query('ROLLBACK')
      }
    })
  })

  describe('platform 0079', () => {
    const SOURCE = randomUUID()
    const reminder = (offsetDays: number, status: string, hash = 'hash-a') =>
      admin.query(
        `INSERT INTO deadline_reminders (source_table, source_deadline_id, organization_id, offset_days, scheduled_for, recipient_role, recipient_email, recipient_email_hash, status)
         VALUES ('grievance_deadlines', $1, $2, $3, now() + interval '5 days', 'grievor', 'g@example.test', $4, $5)`,
        [SOURCE, ORG_A, offsetDays, hash, status],
      )
    const codeOf = (work: Promise<unknown>) => work.then(() => null, (error: { code?: string }) => error.code ?? 'ERROR')
    const indexDefinition = async () => (await rows(`SELECT pg_get_indexdef('public.deadline_reminders_pending_uidx'::regclass) AS definition`))[0].definition as string

    it('makes the pending-uniqueness index a partial unique index over pending reminders, tagged by the migration', async () => {
      expect(await indexDefinition()).toMatch(/CREATE UNIQUE INDEX deadline_reminders_pending_uidx .*\(source_deadline_id, recipient_email_hash, offset_days, reminder_kind\) WHERE \(status = 'pending'::text\)/)
      expect((await rows(`SELECT obj_description('public.deadline_reminders_pending_uidx'::regclass, 'pg_class') AS tag`))[0].tag).toBe('platform-migration:deadline_reminders_pending_partial')
    })

    it('lets a cancelled reminder\'s offset be scheduled again, and still refuses two pending reminders with one key', async () => {
      await reminder(7, 'pending')
      expect(await codeOf(reminder(7, 'pending'))).toBe('23505')

      await admin.query(`UPDATE deadline_reminders SET status = 'cancelled' WHERE source_deadline_id = $1 AND offset_days = 7`, [SOURCE])
      await reminder(7, 'pending')
      await reminder(7, 'cancelled')

      expect(await rows(`SELECT status, count(*)::int AS n FROM deadline_reminders WHERE source_deadline_id = $1 GROUP BY status ORDER BY status`, [SOURCE])).toEqual([{ status: 'cancelled', n: 2 }, { status: 'pending', n: 1 }])
    })

    it('rolls back only while no cancelled and pending reminder share a key, restoring the all-status index; applying again restores the partial one', async () => {
      const rollback = statementsOf('0079_deadline_reminders_pending_partial.rollback.sql', 'migrations-platform')
      await expect(run(rollback)).rejects.toThrow(/share a key/)
      expect(await indexDefinition()).toMatch(/WHERE \(status = 'pending'::text\)/)

      await admin.query(`DELETE FROM deadline_reminders WHERE source_deadline_id = $1`, [SOURCE])
      await run(rollback)
      expect(await indexDefinition()).not.toMatch(/WHERE/)
      await reminder(3, 'pending', 'hash-b')
      expect(await codeOf(reminder(3, 'pending', 'hash-b'))).toBe('23505')
      await admin.query(`DELETE FROM deadline_reminders WHERE source_deadline_id = $1`, [SOURCE])

      await run(statementsOf('0079_deadline_reminders_pending_partial.sql', 'migrations-platform'))
      expect(await indexDefinition()).toMatch(/WHERE \(status = 'pending'::text\)/)
      expect((await rows(`SELECT obj_description('public.deadline_reminders_pending_uidx'::regclass, 'pg_class') AS tag`))[0].tag).toBe('platform-migration:deadline_reminders_pending_partial')
    })

    it('refuses to roll back an index this migration did not make', async () => {
      await admin.query(`COMMENT ON INDEX public.deadline_reminders_pending_uidx IS NULL`)
      try {
        await expect(run(statementsOf('0079_deadline_reminders_pending_partial.rollback.sql', 'migrations-platform'))).rejects.toThrow(/was not made by this migration/)
      } finally {
        await admin.query(`COMMENT ON INDEX public.deadline_reminders_pending_uidx IS 'platform-migration:deadline_reminders_pending_partial'`)
      }
    })
  })

  describe('the privileges the census declared', () => {
    const SYSTEM_HELD: Record<string, string[]> = {
      grievances: ['SELECT'],
      grievance_deadlines: ['SELECT'],
      deadline_audit_events: ['INSERT'],
      in_app_notifications: ['SELECT', 'INSERT', 'DELETE'],
      newsletter_distribution_lists: ['SELECT'],
      newsletter_list_subscribers: ['SELECT', 'UPDATE'],
      platform_invoices: ['SELECT', 'INSERT', 'UPDATE'],
      payment_allocations: ['INSERT'],
      platform_invoice_line_items: ['INSERT'],
      reward_budget_envelopes: ['SELECT', 'UPDATE'],
      reward_wallet_ledger: ['SELECT', 'INSERT'],
      org_subscriptions: ['SELECT', 'INSERT', 'UPDATE'],
      pilot_applications: ['SELECT', 'INSERT', 'UPDATE'],
      external_data_sync_log: ['SELECT', 'INSERT', 'UPDATE'],
      claim_deadlines: ['SELECT'],
      claim_updates: ['SELECT'],
      workbook_governance_lineage_entries: ['SELECT'],
      shopify_config: ['SELECT'],
      course_registrations: ['SELECT'],
      training_courses: ['SELECT'],
      course_sessions: ['SELECT'],
      member_certifications: ['SELECT'],
    }
    const RUNTIME_HELD: Record<string, string[]> = {
      course_registrations: ['SELECT', 'INSERT', 'UPDATE'],
      employer_contacts: ['SELECT', 'INSERT', 'UPDATE'],
      clause_comparisons: ['SELECT', 'INSERT'],
      user_signatures: ['SELECT', 'INSERT', 'UPDATE'],
      job_classifications: ['SELECT', 'INSERT', 'UPDATE'],
      committee_memberships: ['SELECT'],
      integration_sync_logs: ['SELECT'],
    }

    it.each(Object.entries(SYSTEM_HELD))('gives the system role what the cross-organization jobs need on %s', async (table, held) => {
      expect(await privileges(SYSTEM, table)).toEqual(expect.arrayContaining(held))
    })

    it.each(Object.entries(RUNTIME_HELD))('gives the runtime role what the corrected routes need on %s', async (table, held) => {
      expect(await privileges(RUNTIME, table)).toEqual(expect.arrayContaining(held))
    })

    it('lets the system role delete nothing of what this task changed but the delivery markers of in_app_notifications', async () => {
      const deleting = (await Promise.all(Object.keys(SYSTEM_HELD).map(async (table) => ((await privileges(SYSTEM, table)).includes('DELETE') ? table : null)))).filter(Boolean)
      expect(deleting).toEqual(['in_app_notifications'])
    })

    it('keeps the system role off what the retired staging proof harness would have needed: no write on grievances or grievance_deadlines, nothing on notifications', async () => {
      expect(await privileges(SYSTEM, 'grievances')).toEqual(['SELECT'])
      expect(await privileges(SYSTEM, 'grievance_deadlines')).toEqual(['SELECT'])
      expect(await privileges(SYSTEM, 'notifications')).toEqual([])
    })

    it('gives the runtime role no privilege on the system-only relations this task closed', async () => {
      expect(await privileges(RUNTIME, 'shopify_config')).toEqual([])
    })
  })
})
