/**
 * F06 R7 on real PostgreSQL — the unclaimed workbook path under the real roles.
 *
 * Natively the system role (which every unclaimed-workbook route runs under) held no INSERT on workbooks and no privilege at all on
 * workbook_modules or workbook_memory_holders, so the public start route and every memory-holder read and write were refused. The
 * storage-authority manifest now declares what the path needs; this applies exactly those grants (the bootstrap applies them from the
 * manifest) and migration 0056, then proves the path works under the system role, that the capability pair is consistent, that the
 * claim's own statement clears the capability, and that a tenant role sees nothing of an unclaimed workbook.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashCapabilityToken } from '@/lib/icra/assessment-capability'
import { issueWorkbookCapability, workbookCapabilityHolds } from '@/lib/workbook/workbook-capability'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

describe.skipIf(!URL)('unclaimed workbook path on real PostgreSQL as the application roles', () => {
  let admin: pg.Client
  const cap = issueWorkbookCapability()
  const id = randomUUID()
  const user = `wbk-user-${randomUUID().slice(0, 8)}`

  const as = async <T,>(role: string, work: (c: pg.Client) => Promise<T>, context: Record<string, string> = {}): Promise<T> => {
    const client = new pg.Client({ connectionString: URL })
    await client.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SET LOCAL ROLE ${role}`)
      for (const [key, value] of Object.entries(context)) await client.query('SELECT set_config($1, $2, true)', [key, value])
      const result = await work(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      await client.end()
    }
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    // What the manifest now declares for the system role on these tables.
    await admin.query('GRANT SELECT, INSERT, UPDATE ON workbooks TO union_eyes_system')
    await admin.query('GRANT INSERT ON workbook_modules TO union_eyes_system')
    await admin.query('GRANT SELECT, INSERT, UPDATE, DELETE ON workbook_memory_holders TO union_eyes_system')
    const migration = readFileSync(resolve(__dirname, '../migrations-platform/0056_workbook_capability.sql'), 'utf8')
    for (const statement of migration.split('--> statement-breakpoint')) await admin.query(statement)
  }, 120_000)

  afterAll(async () => {
    await admin?.query('DELETE FROM workbook_memory_holders WHERE workbook_id = $1', [id]).catch(() => undefined)
    await admin?.query('DELETE FROM workbook_modules WHERE workbook_id = $1', [id]).catch(() => undefined)
    await admin?.query('DELETE FROM workbooks WHERE id = $1', [id]).catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  it('lets the system role create an unclaimed workbook with its capability hash and seed its modules', async () => {
    await as('union_eyes_system', async (c) => {
      await c.query('INSERT INTO workbooks (id, capability_token_hash, capability_token_expires_at) VALUES ($1, $2, $3)', [id, cap.tokenHash, cap.expiresAt])
      await c.query(`INSERT INTO workbook_modules (workbook_id, module_id, status) VALUES ($1, 'memory_holders', 'not_started') ON CONFLICT DO NOTHING`, [id])
    })
    const stored = (await admin.query('SELECT capability_token_hash AS hash, capability_token_expires_at AS expires FROM workbooks WHERE id = $1', [id])).rows[0]
    expect(stored.hash).toBe(hashCapabilityToken(cap.token))
    expect(stored.hash).not.toContain(cap.token)
    expect(workbookCapabilityHolds(cap.token, { capabilityTokenHash: stored.hash, capabilityTokenExpiresAt: stored.expires })).toBe(true)
    expect(workbookCapabilityHolds(issueWorkbookCapability().token, { capabilityTokenHash: stored.hash, capabilityTokenExpiresAt: stored.expires })).toBe(false)
  })

  it('lets the system role read, add, change and remove the people an unclaimed workbook names', async () => {
    const holder = await as('union_eyes_system', async (c) => {
      await c.query('SELECT id FROM workbooks WHERE id = $1 FOR UPDATE', [id])
      const inserted = (await c.query(`INSERT INTO workbook_memory_holders (workbook_id, role, responsibility, successor_identified) VALUES ($1, 'Treasurer', 'Signs cheques', false) RETURNING id`, [id])).rows[0].id as string
      await c.query(`UPDATE workbook_memory_holders SET notes = 'x' WHERE id = $1`, [inserted])
      expect((await c.query('SELECT count(*)::int AS n FROM workbook_memory_holders WHERE workbook_id = $1', [id])).rows[0].n).toBe(1)
      return inserted
    })
    await as('union_eyes_system', async (c) => {
      await c.query('DELETE FROM workbook_memory_holders WHERE id = $1', [holder])
    })
  })

  it('refuses a half-recorded capability: a hash without an expiry, or the reverse', async () => {
    await expect(admin.query('UPDATE workbooks SET capability_token_expires_at = NULL WHERE id = $1', [id])).rejects.toThrow(/workbooks_capability_pair_check/)
    await expect(admin.query('UPDATE workbooks SET capability_token_hash = NULL WHERE id = $1', [id])).rejects.toThrow(/workbooks_capability_pair_check/)
  })

  it('shows a tenant role nothing of an unclaimed workbook or the people it names', async () => {
    await as('union_eyes_system', async (c) => {
      await c.query(`INSERT INTO workbook_memory_holders (workbook_id, role, responsibility, successor_identified) VALUES ($1, 'Secretary', 'Minutes', false)`, [id])
    })
    const seen = await as('union_eyes_runtime', async (c) => ({
      workbooks: (await c.query('SELECT count(*)::int AS n FROM workbooks WHERE id = $1', [id])).rows[0].n,
      holders: (await c.query('SELECT count(*)::int AS n FROM workbook_memory_holders WHERE workbook_id = $1', [id])).rows[0].n,
    }), { 'app.current_user_id': user })
    expect(seen).toEqual({ workbooks: 0, holders: 0 })
  })

  it('clears the capability in the claim statement itself, so it never outlives the transition to ownership', async () => {
    await as('union_eyes_system', async (c) => {
      const claimed = await c.query(
        `UPDATE workbooks SET claimed_by_user_id = $2, claimed_at = now(), capability_token_hash = NULL, capability_token_expires_at = NULL, status = 'active'
         WHERE id = $1 AND claimed_by_user_id IS NULL RETURNING id`,
        [id, user],
      )
      expect(claimed.rowCount).toBe(1)
    })
    const row = (await admin.query('SELECT capability_token_hash AS hash, capability_token_expires_at AS expires FROM workbooks WHERE id = $1', [id])).rows[0]
    expect(row).toEqual({ hash: null, expires: null })
    expect(workbookCapabilityHolds(cap.token, { capabilityTokenHash: row.hash, capabilityTokenExpiresAt: row.expires })).toBe(false)
  })
})
