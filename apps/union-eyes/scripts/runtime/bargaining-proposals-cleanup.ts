/**
 * Disposable native-QA fixture cleanup for the R-51 HTTP journey.
 *
 * This is development tooling, NOT application code or a deployable API route.
 * Never use this helper against any shared, staging or production database.
 */
import pg from 'pg'

export type BargainingQaRecord = {
  table: 'negotiations' | 'bargaining_proposals'
  id: string
  org: string
}

export async function cleanupBargainingQaRecords(records: BargainingQaRecord[]): Promise<void> {
  // An absent URL must not be silently interpreted as localhost or an alternate database.
  const connection = process.env.DATABASE_URL
  if (!connection) throw new Error('Refusing cleanup without an explicit disposable QA DATABASE_URL')
  const url = new URL(connection)
  if (
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.pathname !== '/ue_runtime' ||
    process.env.QA_TEST_ENV !== 'true' ||
    process.env.UE_ENVIRONMENT !== 'local'
  ) {
    throw new Error('Refusing cleanup outside isolated local Union Eyes QA database')
  }
  const db = new pg.Client({ connectionString: url.toString() })
  await db.connect()
  try {
    for (const row of records.filter((r) => r.table === 'bargaining_proposals')) {
      await db.query(
        'DELETE FROM bargaining_proposals WHERE id = $1 AND negotiation_id IN (SELECT id FROM negotiations WHERE organization_id = $2)',
        [row.id, row.org],
      )
    }
    for (const row of records.filter((r) => r.table === 'negotiations')) {
      await db.query('DELETE FROM negotiations WHERE id = $1 AND organization_id = $2', [row.id, row.org])
    }
  } finally {
    await db.end()
  }
}
