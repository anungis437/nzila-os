// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Analytics Overview
 * GET /api/analytics   → portfolio-level analytics powered by HyperLogLog
 *
 * Computes cardinality estimates across entities: unique shareholders,
 * unique people, document counts, action counts, audit chain stats.
 */
import { NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import {
  entities,
  entityMembers,
  people,
  shareholders,
  documents,
  governanceActions,
  auditEvents,
  shareLedgerEntries,
  resolutions,
  meetings,
} from '@nzila/db/schema'
import { eq, and, sql, count } from 'drizzle-orm'
import { authenticateUser } from '@/lib/api-guards'
import { estimateUnique } from '@/lib/analytics'

export async function GET() {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult.response
  const { userId } = authResult

  // Find all entities the user can access
  const userEntities = await platformDb
    .select({
      id: entities.id,
      legalName: entities.legalName,
      jurisdiction: entities.jurisdiction,
      status: entities.status,
    })
    .from(entities)
    .innerJoin(
      entityMembers,
      and(
        eq(entityMembers.entityId, entities.id),
        eq(entityMembers.clerkUserId, userId),
        eq(entityMembers.status, 'active'),
      ),
    )

  const entityIds = userEntities.map((e) => e.id)

  if (entityIds.length === 0) {
    return NextResponse.json({
      entities: 0,
      uniqueShareholders: { count: 0, precision: 0, standardError: 0 },
      uniquePeople: { count: 0, precision: 0, standardError: 0 },
      totalDocuments: 0,
      totalActions: 0,
      totalAuditEvents: 0,
      totalLedgerEntries: 0,
      totalResolutions: 0,
      totalMeetings: 0,
      entityBreakdown: [],
    })
  }

  // Gather data across all entities for HyperLogLog cardinality estimation
  const allShareholders = await platformDb
    .select({ legalName: people.legalName, email: people.email })
    .from(shareholders)
    .innerJoin(people, eq(people.id, shareholders.holderPersonId))
    .where(
      sql`${shareholders.entityId} IN (${sql.join(
        entityIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    )

  const allPeople = await platformDb
    .select({ legalName: people.legalName, email: people.email })
    .from(people)
    .where(
      sql`${people.id} IN (
        SELECT person_id FROM entity_roles WHERE entity_id IN (${sql.join(
          entityIds.map((id) => sql`${id}`),
          sql`, `,
        )})
      )`,
    )

  // HyperLogLog cardinality estimates
  const shareholderIdentifiers = allShareholders.map(
    (s) => `${s.legalName}|${s.email || ''}`,
  )
  const uniqueShareholders = estimateUnique(shareholderIdentifiers)

  const peopleIdentifiers = allPeople.map(
    (p) => `${p.legalName}|${p.email || ''}`,
  )
  const uniquePeople = estimateUnique(peopleIdentifiers)

  // Aggregate counts
  const entityFilter = sql`entity_id IN (${sql.join(
    entityIds.map((id) => sql`${id}`),
    sql`, `,
  )})`

  const [docCount] = await platformDb
    .select({ count: count() })
    .from(documents)
    .where(entityFilter)

  const [actionCount] = await platformDb
    .select({ count: count() })
    .from(governanceActions)
    .where(entityFilter)

  const [auditCount] = await platformDb
    .select({ count: count() })
    .from(auditEvents)
    .where(entityFilter)

  const [ledgerCount] = await platformDb
    .select({ count: count() })
    .from(shareLedgerEntries)
    .where(entityFilter)

  const [resolutionCount] = await platformDb
    .select({ count: count() })
    .from(resolutions)
    .where(entityFilter)

  const [meetingCount] = await platformDb
    .select({ count: count() })
    .from(meetings)
    .where(entityFilter)

  return NextResponse.json({
    entities: entityIds.length,
    uniqueShareholders,
    uniquePeople,
    totalDocuments: docCount?.count ?? 0,
    totalActions: actionCount?.count ?? 0,
    totalAuditEvents: auditCount?.count ?? 0,
    totalLedgerEntries: ledgerCount?.count ?? 0,
    totalResolutions: resolutionCount?.count ?? 0,
    totalMeetings: meetingCount?.count ?? 0,
    entityBreakdown: userEntities.map((e) => ({
      id: e.id,
      name: e.legalName,
      jurisdiction: e.jurisdiction,
      status: e.status,
    })),
  })
}
