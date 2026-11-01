/**
 * Proves the per-file database isolation of the native project (apps/union-eyes/vitest.native-isolation.ts).
 *
 * With UE_NATIVE_TEMPLATE_URL set, this file must be running in a clone of the template, a write in the clone must not
 * reach the template, and the clone must start from the template's pristine state. It skips when the variable is not set,
 * which the CI results contract reports as an unexpected skip.
 */
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const TEMPLATE = process.env.UE_NATIVE_TEMPLATE_URL
const CLONE = process.env.UE_AUTHORITY_COMBINED_URL

const name = (url: string) => decodeURIComponent(new globalThis.URL(url).pathname.slice(1))

describe.skipIf(!TEMPLATE || !CLONE)('per-file native database isolation', () => {
  let clone: pg.Client
  let template: pg.Client

  beforeAll(async () => {
    clone = new pg.Client({ connectionString: CLONE })
    template = new pg.Client({ connectionString: TEMPLATE })
    await clone.connect()
    await template.connect()
  })
  afterAll(async () => {
    await clone?.query('DROP TABLE IF EXISTS public.ue_isolation_marker').catch(() => undefined)
    await clone?.end().catch(() => undefined)
    await template?.end().catch(() => undefined)
  })

  it('runs this file in its own clone, never in the template', async () => {
    expect(name(CLONE!)).not.toBe(name(TEMPLATE!))
    expect(name(CLONE!)).toMatch(/^ue_native_\d+_[a-z0-9]+_[0-9a-f]{6}$/)
    expect((await clone.query('SELECT current_database() AS db')).rows[0].db).toBe(name(CLONE!))
  })

  it('starts from the pristine converged schema and data of the template', async () => {
    const shape = `SELECT (SELECT count(*) FROM pg_tables WHERE schemaname = 'public')::int AS tables,
                          (SELECT count(*) FROM pg_policy)::int AS policies,
                          (SELECT count(*) FROM public.ue_authority_mandates)::int AS mandates,
                          (SELECT count(*) FROM public.organizations)::int AS organizations`
    const fromClone = (await clone.query(shape)).rows[0]
    const fromTemplate = (await template.query(shape)).rows[0]
    expect(fromClone).toEqual(fromTemplate)
    expect(fromClone.tables).toBeGreaterThan(500)
  })

  it('keeps a write in the clone out of the template', async () => {
    await clone.query('CREATE TABLE public.ue_isolation_marker (id integer)')
    await clone.query('INSERT INTO public.ue_isolation_marker VALUES (1)')
    expect((await clone.query(`SELECT to_regclass('public.ue_isolation_marker')::text AS t`)).rows[0].t).toBe('ue_isolation_marker')
    expect((await template.query(`SELECT to_regclass('public.ue_isolation_marker')::text AS t`)).rows[0].t).toBeNull()
  })
})
