/**
 * Platform 0089, the stable external member identity on organization_members, applies, applies again and rolls back.
 *
 * Every case runs inside a transaction that is rolled back, so the shared native database is left as the bootstrap built it. What this holds:
 *   - the bootstrap built two nullable tagged columns, one tagged partial unique index and one tagged CHECK;
 *   - applying again changes nothing; the rollback removes exactly those, and applying after it restores the same catalog;
 *   - the rollback refuses while a membership holds an external identity, and removes nothing;
 *   - the CHECK refuses an id without its source, a source without an id, and blank values; the index refuses a second membership with the same key in one
 *     organization and allows it in another.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const platform = (file: string) => readFileSync(join(__dirname, '..', 'migrations-platform', file), 'utf8').replace(/\r\n/g, '\n')

const COLUMNS = ['organization_members.external_member_id', 'organization_members.external_member_source']
const INDEXES = ['ux_organization_members_external_identity']
const CONSTRAINTS = ['organization_members_external_identity_whole']

describe.skipIf(!URL)('platform 0089 on the combined schema', () => {
  const up = platform('0089_member_external_identity.sql')
  const down = platform('0089_member_external_identity.rollback.sql')
  let admin: pg.Client

  const inTransaction = async (work: () => Promise<void>) => {
    await admin.query('BEGIN')
    try {
      await work()
    } finally {
      await admin.query('ROLLBACK')
    }
  }
  const codeOf = async (work: () => Promise<unknown>) => {
    await admin.query('SAVEPOINT probe')
    try {
      await work()
      await admin.query('RELEASE SAVEPOINT probe')
      return 'no error'
    } catch (error) {
      await admin.query('ROLLBACK TO SAVEPOINT probe')
      return (error as { code?: string }).code ?? (error as Error).message
    }
  }

  const snapshot = async () => {
    const columns = (
      await admin.query(
        `SELECT c.relname || '.' || a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS not_null, col_description(c.oid, a.attnum) AS tag
           FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'organization_members' AND a.attnum > 0 AND NOT a.attisdropped AND c.relname || '.' || a.attname = ANY($1)
          ORDER BY 1`,
        [COLUMNS],
      )
    ).rows
    const indexes = (
      await admin.query(
        `SELECT i.indexname AS name, i.indexdef AS definition, obj_description(format('public.%I', i.indexname)::regclass, 'pg_class') AS tag FROM pg_indexes i WHERE i.schemaname = 'public' AND i.indexname = ANY($1) ORDER BY 1`,
        [INDEXES],
      )
    ).rows
    const constraints = (
      await admin.query(
        `SELECT c.conname AS name, pg_get_constraintdef(c.oid) AS definition, obj_description(c.oid, 'pg_constraint') AS tag FROM pg_constraint c WHERE c.conname = ANY($1) ORDER BY 1`,
        [CONSTRAINTS],
      )
    ).rows
    return { columns, indexes, constraints }
  }

  const organization = async () => {
    const id = randomUUID()
    await admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1, 'External Identity Fixture', $2, 'local', '{}', 0, '{}', false, 0, 0, '{}', '{}', 'active', now(), now(), 1)`,
      [id, `ext-${id.slice(0, 8)}`],
    )
    return id
  }
  const member = (organizationId: string, source: string | null, externalId: string | null) =>
    admin.query(
      `INSERT INTO organization_members (id, user_id, organization_id, name, email, role, status, is_primary, created_at, updated_at, exempt_from_per_capita, external_member_source, external_member_id)
       VALUES (gen_random_uuid(), $1, $2, 'Synthetic Member', $3, 'member', 'active', false, now(), now(), false, $4, $5)`,
      [`user-${randomUUID()}`, organizationId, `${randomUUID()}@members.example.test`, source, externalId],
    )

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
  }, 60_000)

  afterAll(async () => {
    await admin?.end().catch(() => undefined)
  })

  it('starts as the bootstrap built it: two nullable tagged columns, one tagged partial unique index and one tagged CHECK', async () => {
    const built = await snapshot()
    expect(built.columns).toEqual([
      { name: 'organization_members.external_member_id', type: 'character varying(255)', not_null: false, tag: 'platform-migration:member_external_identity:column' },
      { name: 'organization_members.external_member_source', type: 'character varying(100)', not_null: false, tag: 'platform-migration:member_external_identity:column' },
    ])
    expect(built.indexes).toHaveLength(1)
    expect(built.indexes[0].tag).toBe('platform-migration:member_external_identity:index')
    expect(built.indexes[0].definition).toMatch(
      /^CREATE UNIQUE INDEX \S+ ON public\.organization_members USING btree \(organization_id, external_member_source, external_member_id\) WHERE \(external_member_id IS NOT NULL\)$/,
    )
    expect(built.constraints.map((c) => c.tag)).toEqual(['platform-migration:member_external_identity:constraint'])
  })

  it('applies again and changes nothing', async () => {
    const before = await snapshot()
    await inTransaction(async () => {
      await admin.query(up)
      await admin.query(up)
      expect(await snapshot()).toEqual(before)
    })
  })

  it('rolls back to the schema before it, and applying after it restores the same catalog', async () => {
    const before = await snapshot()
    await inTransaction(async () => {
      await admin.query(down)
      expect(await snapshot()).toEqual({ columns: [], indexes: [], constraints: [] })
      await admin.query(down)
      await admin.query(up)
      expect(await snapshot()).toEqual(before)
    })
    expect(await snapshot()).toEqual(before)
  })

  it('refuses to roll back while a membership holds an external identity, and removes nothing', async () => {
    const before = await snapshot()
    await inTransaction(async () => {
      const org = await organization()
      await member(org, 'registry', '000123')
      const refused = await codeOf(() => admin.query(down))
      expect(refused).not.toBe('no error')
      expect(await snapshot()).toEqual(before)
    })
  })

  it('keeps the key whole and one membership per key in an organization', async () => {
    await inTransaction(async () => {
      const org = await organization()
      const other = await organization()
      expect(await codeOf(() => member(org, null, '1'))).toBe('23514')
      expect(await codeOf(() => member(org, 'registry', null))).toBe('23514')
      expect(await codeOf(() => member(org, '  ', '1'))).toBe('23514')
      expect(await codeOf(() => member(org, 'registry', ' '))).toBe('23514')
      expect(await codeOf(() => member(org, 'registry', '000123'))).toBe('no error')
      expect(await codeOf(() => member(org, 'registry', '000123'))).toBe('23505')
      // Leading zeros are part of the identifier: 123 is another member.
      expect(await codeOf(() => member(org, 'registry', '123'))).toBe('no error')
      expect(await codeOf(() => member(org, 'other-registry', '000123'))).toBe('no error')
      expect(await codeOf(() => member(other, 'registry', '000123'))).toBe('no error')
      expect(await codeOf(() => member(org, null, null))).toBe('no error')
      expect(await codeOf(() => member(org, null, null))).toBe('no error')
    })
  })
})
