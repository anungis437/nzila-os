import pg from 'pg'

/**
 * Persistence inspection for runtime acceptance: reads the application and platform databases directly, outside the
 * application, to prove what the HTTP route actually committed. Dev tooling only (apps/union-eyes/scripts is exempt from the
 * raw-driver boundary because it is not application runtime).
 */
export interface FilingEvidence {
  claim: { status: string; member_id: string; organization_id: string } | undefined
  audit: Array<{ storage_type: string | null; immutable: boolean | null; previous_hash: string | null }>
}

export async function inspectFiling(claimId: string, organizationId: string): Promise<FilingEvidence> {
  const appUrl = process.env.DATABASE_URL
  const platformUrl = process.env.PLATFORM_DATABASE_URL
  if (!appUrl || !platformUrl) throw new Error('DATABASE_URL and PLATFORM_DATABASE_URL are required to inspect persistence')
  const app = new pg.Client({ connectionString: appUrl })
  const platform = new pg.Client({ connectionString: platformUrl })
  await app.connect()
  await platform.connect()
  try {
    const claim = (await app.query('SELECT status, member_id, organization_id FROM claims WHERE claim_id = $1', [claimId])).rows[0]
    const audit = (
      await platform.query(
        'SELECT storage_type, immutable, previous_hash FROM audit_records WHERE organization_id = $1 AND payload::text LIKE $2',
        [organizationId, `%${claimId}%`],
      )
    ).rows
    return { claim, audit }
  } finally {
    await app.end()
    await platform.end()
  }
}
