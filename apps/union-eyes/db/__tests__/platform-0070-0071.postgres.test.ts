/**
 * Platform 0070 (one key per column, one index per definition, no CHECK left unvalidated) and 0071 (consent defaults) on real PostgreSQL (UE-CONV-H-007, UE-CONV-H-008).
 *
 * Proves, on the database Django `migrate` plus the approved platform bootstrap builds:
 *   - 0070 leaves exactly one foreign key on each of the eight columns that carried two, and the key that stays points where the declaration says (claims.claim_id for the
 *     five grievance tables, so a row can be written at all);
 *   - its rollback restores the 15 foreign keys and indexes it dropped, applying it again drops them again, and applying it twice changes nothing;
 *   - it is fail-closed: it will not drop a key when the one that stays is missing, and its rollback will not restore a Django key to claims.id over a grievance row that names
 *     a claims.claim_id value;
 *   - 0071 leaves the six consent and outcome defaults at false, its rollback restores true, a default someone set on purpose is left alone, and no row is rewritten.
 *
 * Every case runs in a transaction that is rolled back. Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { describe, expect, it } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const sqlOf = (file: string) => readFileSync(join(__dirname, '..', 'migrations-platform', file), 'utf8')
const CONSTRAINTS_UP = sqlOf('0070_unambiguous_constraints.sql')
const CONSTRAINTS_DOWN = sqlOf('0070_unambiguous_constraints.rollback.sql')
const DEFAULTS_UP = sqlOf('0071_conservative_consent_defaults.sql')
const DEFAULTS_DOWN = sqlOf('0071_conservative_consent_defaults.rollback.sql')

/** The eight columns that carried two foreign keys: [table, column, parent, parent column, the key that stays]. */
const KEPT_KEYS: Array<[string, string, string, string, string]> = [
  ['cba_clauses', 'cba_id', 'collective_agreements', 'id', 'cba_clauses_cba_id_collective_agreements_id_fk'],
  ['grievance_assignments', 'claim_id', 'claims', 'claim_id', 'grievance_assignments_claim_id_claims_claim_id_fk'],
  ['grievance_communications', 'claim_id', 'claims', 'claim_id', 'grievance_communications_claim_id_claims_claim_id_fk'],
  ['grievance_documents', 'claim_id', 'claims', 'claim_id', 'grievance_documents_claim_id_claims_claim_id_fk'],
  ['grievance_settlements', 'claim_id', 'claims', 'claim_id', 'grievance_settlements_claim_id_claims_claim_id_fk'],
  ['grievance_transitions', 'claim_id', 'claims', 'claim_id', 'grievance_transitions_claim_id_claims_claim_id_fk'],
  ['organization_members', 'organization_id', 'organizations', 'id', 'organization_members_organization_id_fkey'],
  ['strike_fund_disbursements', 'organization_id', 'organizations', 'id', 'strike_fund_disbursements_organization_id_organizations_id_fk'],
]
/** What platform 0070 drops, as Django migrate and the earlier platform migrations named them. */
const DROPPED_KEYS = [
  'cba_clauses_cba_id_4ccb6ac6_fk_collective_agreements_id',
  'grievance_assignments_claim_id_1c041af1_fk_claims_id',
  'grievance_communications_claim_id_38efbb57_fk_claims_id',
  'grievance_documents_claim_id_6840cc51_fk_claims_id',
  'grievance_settlements_claim_id_883b741d_fk_claims_id',
  'grievance_transitions_claim_id_001004b9_fk_claims_id',
  'organization_members_organization_id_d55f4961_fk_organizat',
  'strike_fund_disbursements_organization_id_fkey',
]
const DROPPED_INDEXES = [
  'billing_accounts_org_idx',
  'cba_clauses_cba_id_4ccb6ac6',
  'organization_relationships_child_org_id_8bb5a4d4',
  'organization_relationships_parent_org_id_adbfccee',
  'organizations_legacy_tenant_id_f8e17631',
  'organizations_parent_id_b6fa9bcf',
  'txn_fee_events_idempotency_idx',
]
const CONSENT_DEFAULTS: Array<[string, string]> = [
  ['location_tracking_config', 'location_tracking_enabled'],
  ['member_contact_preferences', 'email_opt_in'],
  ['member_contact_preferences', 'mail_opt_in'],
  ['member_contact_preferences', 'phone_opt_in'],
  ['separated_payment_transactions', 'correct_account_used'],
  ['separated_payment_transactions', 'separation_enforced'],
]
const CHECKS = ['employer_payroll_runs_executor_pair', 'room_bookings_time_order']

describe.skipIf(!URL)('platform 0070 and 0071', () => {
  async function inTransaction<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
    const client = new pg.Client({ connectionString: URL })
    await client.connect()
    try {
      await client.query('BEGIN')
      return await run(client)
    } finally {
      await client.query('ROLLBACK').catch(() => undefined)
      await client.end()
    }
  }

  const keysOn = async (client: pg.Client, table: string, column: string) =>
    (
      await client.query<{ conname: string; parent: string; parent_column: string }>(
        `SELECT k.conname, k.confrelid::regclass::text AS parent,
                (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = k.confrelid AND a.attnum = k.confkey[1]) AS parent_column
           FROM pg_constraint k
          WHERE k.contype = 'f' AND k.conrelid = ('public.' || $1)::regclass
            AND k.conkey = ARRAY[(SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = ('public.' || $1)::regclass AND a.attname = $2)]
          ORDER BY k.conname`,
        [table, column],
      )
    ).rows
  const existing = async (client: pg.Client, kind: 'constraint' | 'index', names: string[]) =>
    (
      await client.query<{ name: string }>(
        kind === 'constraint'
          ? `SELECT conname AS name FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND conname = ANY($1) ORDER BY 1`
          : `SELECT c.relname AS name FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'i' AND c.relname = ANY($1) ORDER BY 1`,
        [names],
      )
    ).rows.map((r) => r.name)
  const defaultOf = async (client: pg.Client, table: string, column: string) =>
    (
      await client.query<{ expression: string | null }>(
        `SELECT pg_get_expr(d.adbin, d.adrelid) AS expression FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
          WHERE a.attrelid = ('public.' || $1)::regclass AND a.attname = $2`,
        [table, column],
      )
    ).rows[0]?.expression

  it('0070 leaves one foreign key on each column, pointing where the declaration says', async () => {
    await inTransaction(async (client) => {
      for (const [table, column, parent, parentColumn, kept] of KEPT_KEYS) {
        const keys = await keysOn(client, table, column)
        expect(keys, `${table}.${column}`).toEqual([{ conname: kept, parent, parent_column: parentColumn }])
      }
      expect(await existing(client, 'constraint', DROPPED_KEYS)).toEqual([])
      expect(await existing(client, 'index', DROPPED_INDEXES)).toEqual([])
      const unvalidated = await client.query(`SELECT conname FROM pg_constraint WHERE conname = ANY($1) AND NOT convalidated`, [CHECKS])
      expect(unvalidated.rows).toEqual([])
    })
  })

  it('0070 rolls back to the keys and indexes it dropped, applies again, and applying twice changes nothing', async () => {
    await inTransaction(async (client) => {
      await client.query(CONSTRAINTS_DOWN)
      expect((await existing(client, 'constraint', DROPPED_KEYS)).sort()).toEqual([...DROPPED_KEYS].sort())
      expect((await existing(client, 'index', DROPPED_INDEXES)).sort()).toEqual([...DROPPED_INDEXES].sort())
      // The five grievance tables carry the contradictory pair again: one key to claims.id, one to claims.claim_id.
      for (const table of ['grievance_assignments', 'grievance_communications', 'grievance_documents', 'grievance_settlements', 'grievance_transitions']) {
        expect((await keysOn(client, table, 'claim_id')).map((k) => k.parent_column).sort(), table).toEqual(['claim_id', 'id'])
      }
      await client.query(CONSTRAINTS_DOWN) // the rollback is idempotent too
      await client.query(CONSTRAINTS_UP)
      await client.query(CONSTRAINTS_UP)
      expect(await existing(client, 'constraint', DROPPED_KEYS)).toEqual([])
      expect(await existing(client, 'index', DROPPED_INDEXES)).toEqual([])
      for (const [table, column, parent, parentColumn, kept] of KEPT_KEYS) {
        expect(await keysOn(client, table, column), `${table}.${column}`).toEqual([{ conname: kept, parent, parent_column: parentColumn }])
      }
    })
  })

  it('0070 will not drop a key when the one that stays is missing', async () => {
    await inTransaction(async (client) => {
      await client.query(CONSTRAINTS_DOWN)
      await client.query('ALTER TABLE grievance_transitions DROP CONSTRAINT grievance_transitions_claim_id_claims_claim_id_fk')
      await client.query('SAVEPOINT refused')
      await expect(client.query(CONSTRAINTS_UP)).rejects.toThrow(/fail-closed.*grievance_transitions_claim_id_claims_claim_id_fk/s)
      await client.query('ROLLBACK TO SAVEPOINT refused')
      // The Django key is still there: nothing was dropped on the way to the refusal.
      expect(await existing(client, 'constraint', ['grievance_transitions_claim_id_001004b9_fk_claims_id'])).toEqual(['grievance_transitions_claim_id_001004b9_fk_claims_id'])
    })
  })

  it('0070 will not drop an index when the one that stays is missing', async () => {
    await inTransaction(async (client) => {
      await client.query(CONSTRAINTS_DOWN)
      await client.query('DROP INDEX public.cba_clauses_cba_idx')
      await client.query('SAVEPOINT refused')
      await expect(client.query(CONSTRAINTS_UP)).rejects.toThrow(/fail-closed.*cba_clauses_cba_idx/s)
      await client.query('ROLLBACK TO SAVEPOINT refused')
      expect(await existing(client, 'index', ['cba_clauses_cba_id_4ccb6ac6'])).toEqual(['cba_clauses_cba_id_4ccb6ac6'])
    })
  })

  it('the 0070 rollback will not restore a key to claims.id over a grievance row that names a claims.claim_id value', async () => {
    await inTransaction(async (client) => {
      // A row the platform key accepts (its claim exists by claim_id) and the Django key to claims.id would refuse (no claim has that id).
      await client.query('SET LOCAL session_replication_role = replica')
      await client.query(
        `INSERT INTO grievance_transitions (organization_id, trigger_type, claim_id, to_stage_id) VALUES (gen_random_uuid(), 'native-proof', gen_random_uuid(), gen_random_uuid())`,
      )
      await client.query('SET LOCAL session_replication_role = origin')
      await client.query('SAVEPOINT refused')
      await expect(client.query(CONSTRAINTS_DOWN)).rejects.toThrow(/rollback fail-closed.*grievance_transitions/s)
      await client.query('ROLLBACK TO SAVEPOINT refused')
    })
  })

  it('0071 leaves six consent and outcome defaults false, its rollback restores true, and no row is rewritten', async () => {
    await inTransaction(async (client) => {
      for (const [table, column] of CONSENT_DEFAULTS) expect(await defaultOf(client, table, column), `${table}.${column}`).toBe('false')
      const before = await client.query(`SELECT count(*)::int AS n FROM member_contact_preferences`)
      await client.query(DEFAULTS_DOWN)
      for (const [table, column] of CONSENT_DEFAULTS) expect(await defaultOf(client, table, column), `${table}.${column}`).toBe('true')
      await client.query(DEFAULTS_DOWN)
      await client.query(DEFAULTS_UP)
      await client.query(DEFAULTS_UP)
      for (const [table, column] of CONSENT_DEFAULTS) expect(await defaultOf(client, table, column), `${table}.${column}`).toBe('false')
      expect((await client.query(`SELECT count(*)::int AS n FROM member_contact_preferences`)).rows[0]).toEqual(before.rows[0])
    })
  })

  it('0071 leaves alone a default that someone set on purpose', async () => {
    await inTransaction(async (client) => {
      await client.query(DEFAULTS_DOWN)
      await client.query('ALTER TABLE location_tracking_config ALTER COLUMN location_tracking_enabled SET DEFAULT (random() > 2)')
      await client.query(DEFAULTS_UP)
      expect(await defaultOf(client, 'location_tracking_config', 'location_tracking_enabled')).toMatch(/random\(\)/)
      // The rest still moved.
      expect(await defaultOf(client, 'member_contact_preferences', 'email_opt_in')).toBe('false')
    })
  })

  it('a row written without a consent or an outcome stores no consent and asserts no outcome', async () => {
    await inTransaction(async (client) => {
      const { rows } = await client.query<{ email_opt_in: boolean; phone_opt_in: boolean; mail_opt_in: boolean }>(
        `INSERT INTO member_contact_preferences (user_id, organization_id) VALUES (gen_random_uuid(), gen_random_uuid())
         RETURNING email_opt_in, phone_opt_in, mail_opt_in`,
      )
      expect(rows[0]).toEqual({ email_opt_in: false, phone_opt_in: false, mail_opt_in: false })
    })
  })
})
