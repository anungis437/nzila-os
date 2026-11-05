/**
 * UE-CONV-H-011 on real PostgreSQL: a raw Date parameter over drizzle's postgres.js driver.
 *
 * Found by the enhanced RBAC native proof (db/__tests__/enhanced-rbac.postgres.test.ts): every audit write threw ERR_INVALID_ARG_TYPE, because drizzle's postgres-js driver
 * leaves the timestamp and date serializers to its column mappers and a Date interpolated into a raw `sql` template has no column. scripts/runtime/raw-date-params.ts
 * found 58 such statements in production code. db/driver-dates.ts (serializeRawDates, applied by every production client) closes the class at the client. This holds, on a
 * real server, with the options the production clients use (prepare: false):
 *   - a drizzle client without the helper refuses a raw Date (the hazard the helper exists for);
 *   - with the helper, a raw Date is its ISO instant for timestamptz, the UTC wall clock for timestamp and the UTC day for date, in a comparison and in an insert, with or
 *     without an explicit cast, and a null is still null;
 *   - what drizzle encodes itself (a column mapper, an operator) is unchanged: an inserted Date reads back as a Date.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable database.
 */
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, gte, sql } from 'drizzle-orm'
import { integer, pgTable, timestamp } from 'drizzle-orm/pg-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { serializeRawDates } from '../driver-dates'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const probe = pgTable('raw_dates_probe', { id: integer('id').notNull(), at: timestamp('at', { withTimezone: true }) })

const messageOf = (error: unknown): string => {
  const parts: string[] = []
  for (let current = error as { message?: string; cause?: unknown } | undefined, depth = 0; current && depth < 5; depth += 1) {
    if (current.message) parts.push(current.message)
    current = current.cause as typeof current
  }
  return parts.join(' <- ')
}

describe.skipIf(!URL)('a raw Date parameter over drizzle and postgres.js, against a real server', () => {
  // One connection each, so the temporary table is the same session's.
  let bare: ReturnType<typeof postgres>
  let helped: ReturnType<typeof postgres>
  let bareDb: ReturnType<typeof drizzle>
  let helpedDb: ReturnType<typeof drizzle>
  const instant = new Date('2026-11-02T23:30:12.531Z')
  const rows = async (db: typeof helpedDb, query: ReturnType<typeof sql>) => Array.from((await db.execute(query)) as unknown as Iterable<Record<string, unknown>>)

  beforeAll(async () => {
    bare = postgres(URL!, { max: 1, prepare: false, onnotice: () => undefined })
    bareDb = drizzle(bare)
    helped = postgres(URL!, { max: 1, prepare: false, onnotice: () => undefined })
    helpedDb = drizzle(helped)
    serializeRawDates(helped)
    await helpedDb.execute(sql`CREATE TEMP TABLE raw_dates_probe (id integer NOT NULL, at timestamptz)`)
  }, 60_000)

  afterAll(async () => {
    await bare?.end({ timeout: 5 }).catch(() => undefined)
    await helped?.end({ timeout: 5 }).catch(() => undefined)
  })

  it('is refused by a drizzle client without the helper: the hazard the helper exists for', async () => {
    let failure = ''
    try {
      await bareDb.execute(sql`SELECT ${instant}::timestamptz AS at`)
    } catch (error) {
      failure = messageOf(error)
    }
    // If drizzle ever serializes a raw Date itself, this fails and the helper can be removed: say so rather than keep dead code.
    expect(failure, 'drizzle now accepts a raw Date on its own: db/driver-dates.ts may no longer be needed').toMatch(/Received an instance of Date/)
  })

  it('is its ISO instant for timestamptz, the UTC wall clock for timestamp and the UTC day for date', async () => {
    const [row] = await rows(
      helpedDb,
      sql`SELECT to_char(${instant}::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS instant,
                 to_char(${instant}::timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS wall_clock,
                 to_char(${instant}::date, 'YYYY-MM-DD') AS day`,
    )
    expect(row).toEqual({ instant: '2026-11-02T23:30:12.531Z', wall_clock: '2026-11-02T23:30:12.531', day: '2026-11-02' })
  })

  it('works without a cast, where the server infers the type from the column, and in a comparison', async () => {
    const early = new Date('2026-01-01T00:00:00.000Z')
    const late = new Date('2026-06-01T00:00:00.000Z')
    await helpedDb.execute(sql`INSERT INTO raw_dates_probe (id, at) VALUES (1, ${early}), (2, ${late}), (3, ${null})`)
    const since = await rows(helpedDb, sql`SELECT id FROM raw_dates_probe WHERE at >= ${new Date('2026-03-01T00:00:00.000Z')} ORDER BY id`)
    expect(since.map((row) => row.id)).toEqual([2])
    const between = await rows(helpedDb, sql`SELECT id FROM raw_dates_probe WHERE at BETWEEN ${early} AND ${late} ORDER BY id`)
    expect(between.map((row) => row.id)).toEqual([1, 2])
    const stored = await rows(helpedDb, sql`SELECT id, to_char(at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at FROM raw_dates_probe ORDER BY id`)
    expect(stored).toEqual([
      { id: 1, at: '2026-01-01T00:00:00.000Z' },
      { id: 2, at: '2026-06-01T00:00:00.000Z' },
      { id: 3, at: null },
    ])
  })

  it('leaves a null a null, and text and numbers as they were', async () => {
    const [row] = await rows(helpedDb, sql`SELECT ${null}::timestamptz IS NULL AS no_date, ${'a text'}::text AS text, ${42}::int AS number, ${true}::boolean AS flag`)
    expect(row).toEqual({ no_date: true, text: 'a text', number: 42, flag: true })
  })

  it('leaves what drizzle encodes itself alone: a column mapper and an operator still take and return a Date', async () => {
    await helpedDb.execute(sql`TRUNCATE raw_dates_probe`)
    await helpedDb.insert(probe).values({ id: 10, at: instant })
    const read = await helpedDb.select().from(probe).where(eq(probe.id, 10))
    expect(read).toHaveLength(1)
    expect(read[0].at).toBeInstanceOf(Date)
    expect(read[0].at!.toISOString()).toBe(instant.toISOString())
    const after = await helpedDb.select({ id: probe.id }).from(probe).where(gte(probe.at, new Date('2026-11-01T00:00:00.000Z')))
    expect(after).toEqual([{ id: 10 }])
  })
})
