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

async function withApp<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    return await work(client)
  } finally {
    await client.end()
  }
}

const QA_CASE = /^aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa[12]$/

/** Returns a seeded QA case to its seeded state so a journey is repeatable. Refuses any case that is not a QA fixture. */
export async function resetQaCase(claimId: string): Promise<void> {
  if (!QA_CASE.test(claimId)) throw new Error('resetQaCase only touches the seeded QA cases')
  await withApp(async (db) => {
    await db.query(
      `DELETE FROM grievance_events WHERE grievance_id IN (SELECT (metadata->>'escalatedGrievanceId')::uuid FROM claims WHERE claim_id = $1 AND metadata ? 'escalatedGrievanceId')`,
      [claimId],
    )
    await db.query(
      `DELETE FROM grievances WHERE id IN (SELECT (metadata->>'escalatedGrievanceId')::uuid FROM claims WHERE claim_id = $1 AND metadata ? 'escalatedGrievanceId')`,
      [claimId],
    )
    await db.query(
      `UPDATE claims SET status = 'submitted', assigned_to = NULL, assigned_at = NULL, resolution_outcome = NULL, closed_at = NULL,
              metadata = metadata - 'escalatedGrievanceId' - 'escalatedGrievanceNumber', updated_at = created_at
        WHERE claim_id = $1 AND claim_id::text LIKE 'aaaaaaaa%'`,
      [claimId],
    )
  })
}

/** Simulates elapsed time in the current status for QA only. The FSM reads status_changed_at, never updated_at. */
export async function ageQaCase(claimId: string, hours: number): Promise<void> {
  if (!QA_CASE.test(claimId)) throw new Error('ageQaCase only touches the seeded QA cases');
  if (!Number.isSafeInteger(hours) || hours < 1 || hours > 8760) throw new Error('Invalid QA case age');
  await withApp(async (db) => {
    const result = await db.query(
      `UPDATE claims SET status_changed_at = now() - make_interval(hours => $2::int)
        WHERE claim_id = $1 AND organization_id = '11111111-1111-4111-8111-111111111111'
        RETURNING claim_id, status_changed_at`,
      [claimId, hours],
    );
    if (result.rowCount !== 1) throw new Error('QA case not found in the designated QA organization');
    const observed = new Date(result.rows[0]?.status_changed_at).getTime();
    const target = Date.now() - hours * 60 * 60 * 1000;
    // Platform 0049 deliberately protects the SLA clock from edits that do not change status.
    // Its trigger may reject this QA-only attempt. Never claim a journey was aged when the clock stayed unchanged.
    if (!Number.isFinite(observed) || Math.abs(observed - target) > 120_000) {
      throw new Error('QA status clock was not backdated: database trigger preserved the authoritative clock; lifecycle acceptance remains unverified');
    }
  });
}

/** The audit details recorded for the assignments of one case, newest first. */
export async function assignmentAudit(claimId: string): Promise<Array<{ action: string; user_id: string | null; metadata: Record<string, unknown> }>> {
  return withApp(async (db) =>
    (await db.query(`SELECT action, user_id, metadata FROM audit_security.audit_logs WHERE metadata->>'caseId' = $1 AND action = 'case.assign' ORDER BY created_at DESC`, [claimId])).rows,
  )
}

export async function inspectCase(claimId: string): Promise<{
  status: string | null
  assignedTo: string | null
  resolutionOutcome: string | null
  grievances: number
  grievanceEvents: number
}> {
  return withApp(async (db) => {
    const claim = (await db.query('SELECT status, assigned_to, resolution_outcome, metadata FROM claims WHERE claim_id = $1', [claimId])).rows[0]
    const grievanceId: string | undefined = claim?.metadata?.escalatedGrievanceId
    const grievances = grievanceId ? Number((await db.query('SELECT count(*) FROM grievances WHERE id = $1', [grievanceId])).rows[0].count) : 0
    const events = grievanceId ? Number((await db.query('SELECT count(*) FROM grievance_events WHERE grievance_id = $1', [grievanceId])).rows[0].count) : 0
    return { status: claim?.status ?? null, assignedTo: claim?.assigned_to ?? null, resolutionOutcome: claim?.resolution_outcome ?? null, grievances, grievanceEvents: events }
  })
}

/** Counts every grievance in the QA organization, to prove a refused escalation left nothing behind. */
export async function countGrievances(organizationId: string): Promise<number> {
  return withApp(async (db) => Number((await db.query('SELECT count(*) FROM grievances WHERE organization_id = $1', [organizationId])).rows[0].count))
}

export async function financeRows(remittanceId: string): Promise<Array<Record<string, unknown>>> {
  return withApp(async (db) => (await db.query('SELECT * FROM employer_remittances WHERE id = $1', [remittanceId])).rows)
}

/** Audit actions recorded for one finance record. */
export async function financeAudit(resourceId: string): Promise<Array<{ action: string; user_id: string | null }>> {
  return withApp(async (db) =>
    (await db.query(`SELECT action, user_id FROM audit_security.audit_logs WHERE resource_id::text = $1 ORDER BY created_at`, [resourceId])).rows,
  )
}

/** A shared (non-organization) testimonial row, for proving that no organization administrator can delete it. */
export async function seedTestimonial(id: string): Promise<void> {
  await withApp(async (db) => {
    await db.query('DELETE FROM testimonials WHERE id = $1', [id])
    await db.query(
      `INSERT INTO testimonials (id, updated_at, type, quote, author, role, featured, visibility, created_at)
       VALUES ($1, now(), 'member', 'QA shared testimonial', 'QA', 'member', false, 'internal', now())`,
      [id],
    )
  })
}

export async function testimonialState(id: string): Promise<{ exists: boolean; visibility: string | null }> {
  return withApp(async (db) => {
    const row = (await db.query('SELECT visibility FROM testimonials WHERE id = $1', [id])).rows[0]
    return { exists: Boolean(row), visibility: row?.visibility ?? null }
  })
}
