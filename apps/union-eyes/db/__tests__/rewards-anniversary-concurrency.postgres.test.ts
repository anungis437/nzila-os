/** Recorded automation authority is deferred. Concurrent authentic machine-role
 * SQL cannot resurrect credit issuance through the former anniversary job.
 * Actual native PG15/16 only on the central owned disposable clone topology. */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { nativeActionUrl } from '@/scripts/runtime/native-canonical-fixture'
vi.mock('@/db', () => ({ db: {} }))
import { processAnniversaryAwards } from '@/lib/services/rewards/automation-service'
const URL = process.env.UE_AUTHORITY_COMBINED_URL
describe.skipIf(!URL)('deferred anniversary credit authority on the actual native role', () => {
  let operator: pg.Client, system: pg.Pool
  const org = randomUUID()
  beforeAll(async () => {
    const systemUrl = nativeActionUrl('union_eyes_system', URL)
    operator = new pg.Client({ connectionString: URL })
    await operator.connect()
    system = new pg.Pool({ connectionString: systemUrl, max: 2, options: '-c role=union_eyes_system' })
  })
  afterAll(async () => {
    await system?.end()
    await operator?.end()
  })
  it('uses a distinct non-superuser native LOGIN for machine SQL', async () => {
    const rows = (
      await system.query(
        'SELECT current_user,session_user,rolsuper,rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user',
      )
    ).rows
    expect(rows).toEqual([
      expect.objectContaining({
        current_user: 'union_eyes_system',
        rolsuper: false,
        rolbypassrls: false,
      }),
    ])
    expect(rows[0].session_user).toMatch(/^ue_native_[a-z0-9_]+_system$/)
  })
  it('refuses both overlapping former automation calls before financial effects', async () => {
    const results = await Promise.allSettled([
      processAnniversaryAwards(org),
      processAnniversaryAwards(org),
    ])
    for (const result of results) {
      expect(result.status).toBe('rejected')
      if (result.status === 'rejected')
        expect(result.reason).toMatchObject({ code: 'NOT_IMPLEMENTED', status: 501 })
    }
    expect(
      (
        await operator.query(
          'SELECT count(*)::int AS n FROM public.reward_wallet_ledger WHERE org_id=$1',
          [org],
        )
      ).rows,
    ).toEqual([{ n: 0 }])
  })
  it('also refuses concurrent direct machine SQL credit inserts without records or broad grants', async () => {
    const results = await Promise.allSettled([
      system.query('INSERT INTO public.reward_wallet_ledger DEFAULT VALUES'),
      system.query('INSERT INTO public.reward_wallet_ledger DEFAULT VALUES'),
    ])
    for (const result of results) {
      expect(result.status).toBe('rejected')
      if (result.status === 'rejected') expect(result.reason).toMatchObject({ code: '42501' })
    }
    expect(
      (
        await operator.query(
          'SELECT count(*)::int AS n FROM public.reward_wallet_ledger WHERE org_id=$1',
          [org],
        )
      ).rows,
    ).toEqual([{ n: 0 }])
  })
})
