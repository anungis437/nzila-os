/**
 * Native PostgreSQL qualification of the signature audit trail's append-only authority and the statements the hash chain depends on.
 *
 * The chain makes a changed or removed event detectable; the table's privileges make it unavailable to the application roles in the
 * first place. This proves, against the combined Django-plus-Drizzle database, that the runtime role may read and add events but not
 * update or delete one, that the system role holds no write on it either, and that the chain's lock and ordering statements run as
 * the runtime role. Needs UE_AUTHORITY_COMBINED_URL; skipped when it is not set.
 */
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL_ = process.env.UE_AUTHORITY_COMBINED_URL

describe.skipIf(!URL_)('signature_audit_trail on native PostgreSQL', () => {
  let client: pg.Client

  beforeAll(async () => {
    client = new pg.Client({ connectionString: URL_ })
    await client.connect()
  })
  afterAll(async () => { await client?.end() })

  const privilege = async (role: string, kind: string) =>
    (await client.query(`SELECT has_table_privilege($1, 'public.signature_audit_trail', $2) AS granted`, [role, kind])).rows[0].granted as boolean

  it('lets the runtime role read and add events', async () => {
    expect(await privilege('union_eyes_runtime', 'SELECT')).toBe(true)
    expect(await privilege('union_eyes_runtime', 'INSERT')).toBe(true)
  })

  it('does not let the runtime role change or remove an event', async () => {
    expect(await privilege('union_eyes_runtime', 'UPDATE')).toBe(false)
    expect(await privilege('union_eyes_runtime', 'DELETE')).toBe(false)
    expect(await privilege('union_eyes_runtime', 'TRUNCATE')).toBe(false)
  })

  it('gives the system role no write on the trail', async () => {
    for (const kind of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) expect(await privilege('union_eyes_system', kind)).toBe(false)
  })

  it('runs the chain\'s lock and ordering statements as the runtime role', async () => {
    await client.query('BEGIN')
    try {
      await client.query('SET LOCAL ROLE union_eyes_runtime')
      await client.query(`SELECT set_config('app.current_org_id', '00000000-0000-4000-8000-000000000001', true)`)
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended('signature_audit:00000000-0000-4000-8000-0000000000d1', 0))`)
      const tail = await client.query(
        `SELECT hash_chain, metadata FROM signature_audit_trail
          WHERE document_id = $1::uuid AND (metadata->>'chainSeq') IS NOT NULL
          ORDER BY (metadata->>'chainSeq')::int DESC LIMIT 1`,
        ['00000000-0000-4000-8000-0000000000d1'],
      )
      expect(tail.rows).toEqual([])
    } finally {
      await client.query('ROLLBACK')
    }
  })
})
