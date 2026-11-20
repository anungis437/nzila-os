/**
 * Native PostgreSQL qualification of the signature audit trail's append-only authority and the statements the hash chain depends on.
 *
 * The chain makes a changed or removed event detectable; the table's privileges make it unavailable to the application roles in the
 * first place. The canonical source now contains the trail (CONTAINED_NO_AUTHORITY in lib/operations/catalog-v2-decisions.json: no runtime
 * or system grant), and every signature operation that would record or read it answers 501 (lib/reality/contained-storage.ts). This proves,
 * against the combined Django-plus-Drizzle database, that no application role may read, add, change or remove an event, and that the
 * chain's ordering read is refused to the runtime role. Needs UE_AUTHORITY_COMBINED_URL; skipped when it is not set.
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

  it('gives the runtime role no read and no add on the trail: the canonical source contains it', async () => {
    expect(await privilege('union_eyes_runtime', 'SELECT')).toBe(false)
    expect(await privilege('union_eyes_runtime', 'INSERT')).toBe(false)
  })

  it('does not let the runtime role change or remove an event', async () => {
    expect(await privilege('union_eyes_runtime', 'UPDATE')).toBe(false)
    expect(await privilege('union_eyes_runtime', 'DELETE')).toBe(false)
    expect(await privilege('union_eyes_runtime', 'TRUNCATE')).toBe(false)
  })

  it('gives the system role no write on the trail', async () => {
    for (const kind of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) expect(await privilege('union_eyes_system', kind)).toBe(false)
  })

  it('refuses the chain\'s ordering read to the runtime role', async () => {
    await client.query('BEGIN')
    try {
      await client.query('SET LOCAL ROLE union_eyes_runtime')
      await client.query(`SELECT set_config('app.current_org_id', '00000000-0000-4000-8000-000000000001', true)`)
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended('signature_audit:00000000-0000-4000-8000-0000000000d1', 0))`)
      await expect(client.query(
        `SELECT hash_chain, metadata FROM signature_audit_trail
          WHERE document_id = $1::uuid AND (metadata->>'chainSeq') IS NOT NULL
          ORDER BY (metadata->>'chainSeq')::int DESC LIMIT 1`,
        ['00000000-0000-4000-8000-0000000000d1'],
      )).rejects.toThrow(/permission denied for table signature_audit_trail/)
    } finally {
      await client.query('ROLLBACK')
    }
  })
})
