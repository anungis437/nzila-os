/** Read-only evidence from the owned fixture operator, outside the serving app. */
import pg from 'pg'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'
import { ownedRuntimeOperatorUrl } from './fixture-auth'

export async function financeBoundarySnapshot() {
  const connectionString = ownedRuntimeOperatorUrl()
  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    await client.query('BEGIN READ ONLY')
    const row = (
      await client.query(
        `SELECT count(*)::integer AS n FROM public.ue_authority_mandates WHERE kind='financial' AND principal_user_id=ANY($1::text[])`,
        [Object.values(UE_TEST_USERS).map((person) => person.userId)],
      )
    ).rows[0]
    const tables: Record<string, { exists: boolean; rows: number | null }> = {}
    for (const table of [
      'donations',
      'employer_remittances',
      'dues_ledger',
      'financial_transactions',
    ]) {
      const exists = Boolean(
        (await client.query('SELECT pg_catalog.to_regclass($1) AS relation', [`public.${table}`]))
          .rows[0].relation,
      )
      tables[table] = {
        exists,
        rows: exists
          ? (await client.query(`SELECT count(*)::integer AS n FROM public."${table}"`)).rows[0].n
          : null,
      }
    }
    await client.query('COMMIT')
    return { fixtureFinancialMandates: row.n as number, tables }
  } finally {
    await client.end()
  }
}
