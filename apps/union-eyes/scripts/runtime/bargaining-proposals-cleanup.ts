/**
 * Disposable native-QA fixture cleanup for the R-51 HTTP journey.
 *
 * This is development tooling, NOT application code or a deployable API route.
 * Never use this helper against any shared, staging or production database.
 */
import pg from 'pg'
import { ownedRuntimeOperatorUrl } from './fixture-auth'
import { UE_TEST_ORGS } from '@/tests/fixtures/test-orgs'

export type BargainingQaRecord = {
  table: 'negotiations' | 'bargaining_proposals'
  id: string
  org: string
}

export async function cleanupBargainingQaRecords(records: BargainingQaRecord[]): Promise<void> {
  const connection = ownedRuntimeOperatorUrl()
  const url = new URL(connection)
  if (
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.pathname !== '/ue_runtime' ||
    process.env.QA_TEST_ENV !== 'true' ||
    process.env.UE_ENVIRONMENT !== 'local'
  ) {
    throw new Error('Refusing cleanup outside isolated local Union Eyes QA database')
  }
  if (
    records.some(
      (row) =>
        !['negotiations', 'bargaining_proposals'].includes(row.table) ||
        !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(row.id) ||
        ![UE_TEST_ORGS.primary.id, UE_TEST_ORGS.secondary.id].some((id) => id === row.org),
    )
  )
    throw new Error('Only exact returned fixture records and organizations may be cleaned up')
  const db = new pg.Client({ connectionString: url.toString() })
  await db.connect()
  try {
    await db.query('BEGIN')
    for (const row of records.filter((r) => r.table === 'bargaining_proposals')) {
      await db.query(
        'DELETE FROM public.bargaining_proposals WHERE id = $1 AND negotiation_id IN (SELECT id FROM public.negotiations WHERE organization_id = $2)',
        [row.id, row.org],
      )
    }
    for (const row of records.filter((r) => r.table === 'negotiations')) {
      await db.query('DELETE FROM public.negotiations WHERE id = $1 AND organization_id = $2', [
        row.id,
        row.org,
      ])
    }
    await db.query('COMMIT')
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  } finally {
    await db.end()
  }
}
