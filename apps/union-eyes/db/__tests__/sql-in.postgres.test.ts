/**
 * sqlIn and inArray on real PostgreSQL: the statements a list of values in hand-written SQL now sends are statements the database accepts.
 *
 * The spelling they replace (an array handed to ANY inside a Drizzle template) was refused on its first run whatever the length (42809, 22P02, 42846),
 * which unit tests that mock the database could not show. This runs both replacements against a text, a uuid and an enum column, with one value, several
 * and none, and confirms the refused spelling is still refused, so the characterization in lib/db/__tests__/sql-in.test.ts has a database behind it.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { inArray, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cbaIntelSources } from '../schema'
import { sqlIn } from '../../lib/db/sql-in'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

describe.skipIf(!URL)('lists of values in SQL on real PostgreSQL', () => {
  const tag = `si${randomUUID().slice(0, 8)}`
  let pool: pg.Pool
  let db: ReturnType<typeof drizzle>
  const ids: string[] = []
  const slugs = [`a-${tag}`, `b-${tag}`, `c-${tag}`]

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: URL!, max: 2 })
    db = drizzle(pool)
    for (const [index, slug] of slugs.entries()) {
      const { rows } = await pool.query(
        `INSERT INTO public.cba_intel_sources (slug, name, name_en, source_type, collection_method, base_url, trust_tier)
         VALUES ($1, $1, $1, $2, 'manual_upload', 'https://example.test', $3) RETURNING id::text AS id`,
        [slug, index === 2 ? 'academic' : 'federal_labour', index === 0 ? 'official' : 'curated'],
      )
      ids.push(rows[0].id)
    }
  })

  afterAll(async () => {
    await pool?.query('DELETE FROM public.cba_intel_sources WHERE slug = ANY($1)', [slugs])
    await pool?.end()
  })

  const matching = async (condition: ReturnType<typeof sql>) =>
    ((await db.execute(sql`SELECT slug FROM public.cba_intel_sources WHERE slug LIKE ${`%-${tag}`} AND ${condition} ORDER BY slug`)).rows as Array<{ slug: string }>).map((row) => row.slug)

  it('sqlIn matches the values given, as text, uuid and enum columns, for one value, several and none', async () => {
    expect(await matching(sqlIn(sql`slug`, [slugs[0]]))).toEqual([slugs[0]])
    expect(await matching(sqlIn(sql`slug`, [slugs[0], slugs[2]]))).toEqual([slugs[0], slugs[2]])
    expect(await matching(sqlIn(sql`id`, [ids[1], ids[2], randomUUID()]))).toEqual([slugs[1], slugs[2]])
    expect(await matching(sqlIn(sql`source_type`, ['federal_labour']))).toEqual([slugs[0], slugs[1]])
    expect(await matching(sqlIn(sql`trust_tier`, ['official', 'curated']))).toEqual(slugs)
    expect(await matching(sqlIn(sql`slug`, []))).toEqual([])
  })

  it('inArray matches a column the same way', async () => {
    const rows = await db.select({ slug: cbaIntelSources.slug }).from(cbaIntelSources).where(inArray(cbaIntelSources.id, [ids[0], ids[2]]))
    expect(rows.map((row) => row.slug).sort()).toEqual([slugs[0], slugs[2]])
    expect(await db.select().from(cbaIntelSources).where(inArray(cbaIntelSources.id, []))).toEqual([])
  })

  it('still refuses the spelling they replace, whatever the number of values', async () => {
    const refused = async (values: string[]) =>
      db.execute(sql`SELECT slug FROM public.cba_intel_sources WHERE id = ANY(${values})`).then(
        () => null,
        (error: { cause?: { code?: string } }) => error.cause?.code ?? 'no code',
      )
    expect(await refused([ids[0]])).toBe('22P02')
    expect(await refused([ids[0], ids[1]])).toBe('42809')
    expect(await refused([ids[0], ids[1], ids[2]])).toBe('42809')
  })
})
