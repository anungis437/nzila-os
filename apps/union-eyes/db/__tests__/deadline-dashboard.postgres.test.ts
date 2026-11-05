/**
 * The deadline dashboard query on real PostgreSQL, as the tenant runtime role (GET /api/deadlines/dashboard, UE-CONV-H-017).
 *
 * claim_deadlines.is_overdue, days_until_due and days_overdue are stored columns that no writer maintains, so the dashboard used to count overdue and due-soon
 * deadlines from columns that are always at their defaults. It now reads due_date and the clock. What it holds, over the real table under FORCE row-level security:
 *   - active, overdue, due-soon and critical counts, the average days overdue and the on-time percentage come from due_date, status and completed_at;
 *   - a stale stored flag changes nothing: a deadline marked overdue that is still in the future is not overdue, one not marked that is past due is;
 *   - one organization never counts another's deadlines, also when the query names the other organization (row-level security answers before the predicate);
 *   - an organization with no deadlines reads as no work and 100 percent on time.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { serializeRawDates } from '@/db/driver-dates'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const state = vi.hoisted(() => ({ db: null as unknown, organization: '' }))

async function inRole<T>(organizationId: string, work: (tx: unknown) => Promise<T>): Promise<T> {
  const db = state.db as { transaction: <R>(fn: (tx: { execute: (query: unknown) => Promise<unknown> }) => Promise<R>) => Promise<R> }
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw('SET LOCAL ROLE union_eyes_runtime'))
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${organizationId}, true)`)
    return work(tx)
  })
}

// The query asks for the request's transaction; the test's request belongs to state.organization.
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (work: (tx: unknown) => Promise<unknown>) => inRole(state.organization, work),
}))

const queries = URL ? await import('@/db/queries/deadline-queries') : null

describe.skipIf(!URL)('the deadline dashboard on the combined schema, as the real runtime role', () => {
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const ORG_EMPTY = randomUUID()
  let admin: pg.Client
  let client: ReturnType<typeof postgres>

  const deadline = (
    organizationId: string,
    row: { due: string; status?: string; priority?: string; completed?: string | null; storedOverdue?: boolean },
  ) =>
    admin.query(
      `INSERT INTO claim_deadlines (claim_id, organization_id, deadline_name, deadline_type, due_date, event_date, original_deadline, status, priority, is_overdue, completed_at)
       VALUES ($1, $2, 'Step 1 reply', 'filing', now() + $3::interval, now() - interval '60 days', now() + $3::interval, $4, $5, $6,
               CASE WHEN $7::text IS NULL THEN NULL ELSE now() + $7::interval END)`,
      [randomUUID(), organizationId, row.due, row.status ?? 'pending', row.priority ?? 'medium', row.storedOverdue ?? false, row.completed ?? null],
    )

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    client = postgres(URL!, { max: 2, onnotice: () => undefined })
    state.db = drizzle(client)
    serializeRawDates(client)
    const sfx = randomUUID().slice(0, 8)
    for (const [id, name] of [
      [ORG_A, 'Deadline Fixture Local A'],
      [ORG_B, 'Deadline Fixture Local B'],
      [ORG_EMPTY, 'Deadline Fixture Local Empty'],
    ]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [id, name, `deadline-${sfx}-${id.slice(0, 6)}`],
      )
    }

    // Organization A: five pending (one overdue by five days, two due within three days of which one is critical, and a stale flag each way),
    // two completed (one on time, one late) and one missed.
    await deadline(ORG_A, { due: '10 days' })
    await deadline(ORG_A, { due: '2 days' })
    await deadline(ORG_A, { due: '-5 days' })
    await deadline(ORG_A, { due: '1 day', priority: 'critical' })
    await deadline(ORG_A, { due: '30 days', storedOverdue: true })
    await deadline(ORG_A, { due: '-10 days', status: 'completed', completed: '-11 days' })
    await deadline(ORG_A, { due: '-10 days', status: 'completed', completed: '-9 days' })
    await deadline(ORG_A, { due: '-3 days', status: 'missed' })
    // Organization B: three pending deadlines past due, none of which organization A may count.
    for (const due of ['-1 day', '-2 days', '-3 days']) await deadline(ORG_B, { due })
  }, 120_000)

  afterAll(async () => {
    await client?.end({ timeout: 5 }).catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  const summaryFor = (sessionOrganization: string, queriedOrganization = sessionOrganization) => {
    state.organization = sessionOrganization
    return queries!.getDeadlineDashboardSummary(queriedOrganization)
  }

  it('counts from due_date, status and completed_at', async () => {
    expect(await summaryFor(ORG_A)).toEqual({
      activeDeadlines: 5,
      overdueCount: 1,
      dueSoonCount: 2,
      criticalCount: 1,
      avgDaysOverdue: 5,
      onTimePercentage: 33,
    })
  })

  it('ignores the stored flags: a future deadline marked overdue is not overdue, a past one not marked is', async () => {
    const summary = await summaryFor(ORG_A)
    // The 30-day deadline carries is_overdue = true and the five-days-late one carries false; the count follows the clock.
    expect(summary.overdueCount).toBe(1)
    expect(summary.avgDaysOverdue).toBe(5)
  })

  it("counts another organization's deadlines for its own session only", async () => {
    expect(await summaryFor(ORG_B)).toEqual({
      activeDeadlines: 3,
      overdueCount: 3,
      dueSoonCount: 0,
      criticalCount: 0,
      avgDaysOverdue: 2,
      onTimePercentage: 100,
    })
  })

  it('answers with nothing for an organization named from another organization session', async () => {
    expect(await summaryFor(ORG_B, ORG_A)).toEqual({
      activeDeadlines: 0,
      overdueCount: 0,
      dueSoonCount: 0,
      criticalCount: 0,
      avgDaysOverdue: 0,
      onTimePercentage: 100,
    })
  })

  it('reads an organization with no deadlines as no work, all on time', async () => {
    expect(await summaryFor(ORG_EMPTY)).toEqual({
      activeDeadlines: 0,
      overdueCount: 0,
      dueSoonCount: 0,
      criticalCount: 0,
      avgDaysOverdue: 0,
      onTimePercentage: 100,
    })
  })
})
