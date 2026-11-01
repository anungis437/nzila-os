/**
 * Native PostgreSQL proof for DEF-0B11-PRP-REWARDS-CRON-ANNIVERSARY-AWARDS-REPEAT-ON-EVERY-CALL-ON-AN-ANNIVERSARY-DAY.
 *
 * The real automation and award services run against a database built by Django `migrate` plus the approved Drizzle
 * bootstrap, on a connection pool, so overlapping runs really are concurrent. A pre-insert lookup alone lets two overlapping
 * runs both see "not yet awarded"; the job takes a transaction-scoped advisory lock keyed on organization and award type and
 * writes through that transaction, so the second run waits and then finds the first run's awards.
 *
 * It also proves the anniversary query itself against the real organization_members columns (the earlier query selected a
 * column the table does not have, so the job could not run at all) and that only active members are rewarded.
 *
 * Needs UE_AUTHORITY_COMBINED_URL; skipped when it is not set.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const state = vi.hoisted(() => ({ db: null as unknown }))

vi.mock('@/db', () => ({
  db: new Proxy({}, {
    get(_t, prop) {
      const real = state.db as Record<PropertyKey, unknown>
      const value = real[prop]
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value
    },
  }),
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

describe.skipIf(!URL)('anniversary awards on the combined schema, on a connection pool', () => {
  const ORG = randomUUID()
  const OTHER_ORG = randomUUID()
  let pool: pg.Pool
  let awardType: string

  const scalar = async (query: string, params: unknown[] = []) => (await pool.query(query, params)).rows[0]

  async function org(id: string) {
    await pool.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [id, `anniv-${id.slice(0, 6)}`, `anniv-${id.slice(0, 6)}`],
    )
  }
  async function member(organizationId: string, user: string, status = 'active', deleted = false) {
    await pool.query(
      `INSERT INTO organization_members (user_id, organization_id, role, status, is_primary, name, email, joined_at, deleted_at, created_at, updated_at)
       VALUES ($1,$2,'member',$3,false,$4,$5,CURRENT_DATE - interval '3 years', ${deleted ? 'now()' : 'NULL'}, now(), now())`,
      [user, organizationId, status, `Name ${user}`, `${user}@example.test`],
    )
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: URL, max: 10 })
    const schema = await import('@/db/schema')
    state.db = drizzle(pool, { schema })
    await org(ORG)
    await org(OTHER_ORG)
    const program = randomUUID()
    awardType = randomUUID()
    await pool.query(`INSERT INTO recognition_programs (id, org_id, name, status) VALUES ($1,$2,'Recognition','active')`, [program, ORG])
    await pool.query(
      `INSERT INTO recognition_award_types (id, org_id, program_id, name, kind, default_credit_amount, requires_approval) VALUES ($1,$2,$3,'Work Anniversary','automated',5,false)`,
      [awardType, ORG, program],
    )
    for (const user of ['m1', 'm2', 'm3']) await member(ORG, user)
    await member(ORG, 'suspended', 'suspended')
    await member(ORG, 'removed', 'active', true)
    await member(OTHER_ORG, 'other-org-member')
    vi.useFakeTimers({ toFake: ['Date'] })
    const { d } = await scalar(`SELECT CURRENT_DATE::text AS d`)
    vi.setSystemTime(new Date(`${d}T12:00:00Z`))
  }, 120_000)

  afterAll(async () => {
    vi.useRealTimers()
    await pool?.end()
  })

  it('six overlapping runs award each active member exactly once, and nobody else', async () => {
    const { processAnniversaryAwards } = await import('../../lib/services/rewards/automation-service')
    const results = await Promise.all(Array.from({ length: 6 }, () => processAnniversaryAwards(ORG)))
    expect(results.every((r) => r.success)).toBe(true)
    expect(results.reduce((sum, r) => sum + (r.processed ?? 0), 0)).toBe(3)

    const awards = (await pool.query(`SELECT recipient_user_id, status FROM recognition_awards WHERE org_id = $1 ORDER BY recipient_user_id`, [ORG])).rows
    expect(awards.map((a) => a.recipient_user_id)).toEqual(['m1', 'm2', 'm3'])
    expect(awards.every((a) => a.status === 'issued')).toBe(true)
  })

  it('a later run the same day awards nothing, and another organization is untouched', async () => {
    const { processAnniversaryAwards } = await import('../../lib/services/rewards/automation-service')
    expect(await processAnniversaryAwards(ORG)).toMatchObject({ success: true, processed: 0 })
    expect(Number((await scalar(`SELECT count(*) AS n FROM recognition_awards WHERE org_id = $1`, [ORG])).n)).toBe(3)
    expect(Number((await scalar(`SELECT count(*) AS n FROM recognition_awards WHERE org_id = $1`, [OTHER_ORG])).n)).toBe(0)
  })
})
