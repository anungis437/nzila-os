import { platformDb } from '@nzila/db/platform'
import {
  orgs,
  orgMembers,
  orgRoles,
  people,
  shareholders,
  documents,
  governanceActions,
  auditEvents,
  shareLedgerEntries,
  resolutions,
  meetings,
  approvals,
  platformCostRollups,
} from '@nzila/db/schema'
import { eq, and, count, inArray, desc, asc, gte } from 'drizzle-orm'
import { estimateUnique } from '@/lib/analytics'
function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}
function isoDayOffset(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

export async function readPortfolioAnalytics(userId: string) {
  // Find all orgs the user can access
  const userEntities = await platformDb
    .select({
      id: orgs.id,
      legalName: orgs.legalName,
      jurisdiction: orgs.jurisdiction,
      status: orgs.status,
    })
    .from(orgs)
    .innerJoin(
      orgMembers,
      and(
        eq(orgMembers.orgId, orgs.id),
        eq(orgMembers.userId, userId),
        eq(orgMembers.status, 'active'),
      ),
    )
  const entityIds = userEntities.map((e) => e.id)
  if (entityIds.length === 0) {
    return {
      status: 200,
      body: {
        orgs: 0,
        uniqueShareholders: { count: 0, precision: 0, standardError: 0 },
        uniquePeople: { count: 0, precision: 0, standardError: 0 },
        totalDocuments: 0,
        totalActions: 0,
        totalAuditEvents: 0,
        totalLedgerEntries: 0,
        totalResolutions: 0,
        totalMeetings: 0,
        entityBreakdown: [],
      },
    }
  }
  // Gather data across all orgs for HyperLogLog cardinality estimation
  const allShareholders = await platformDb
    .select({ legalName: people.legalName, email: people.email })
    .from(shareholders)
    .innerJoin(people, eq(people.id, shareholders.holderPersonId))
    .where(inArray(shareholders.orgId, entityIds))
  const orgRoleRows = await platformDb
    .select({ personId: orgRoles.personId })
    .from(orgRoles)
    .where(inArray(orgRoles.orgId, entityIds))
  const personIds = Array.from(
    new Set(orgRoleRows.map((r) => r.personId).filter((id): id is string => Boolean(id))),
  )
  const allPeople = personIds.length
    ? await platformDb
        .select({ legalName: people.legalName, email: people.email })
        .from(people)
        .where(inArray(people.id, personIds))
    : []
  // HyperLogLog cardinality estimates
  const shareholderIdentifiers = allShareholders.map((s) => `${s.legalName}|${s.email || ''}`)
  const uniqueShareholdersEstimate = estimateUnique(shareholderIdentifiers)
  const peopleIdentifiers = allPeople.map((p) => `${p.legalName}|${p.email || ''}`)
  const uniquePeopleEstimate = estimateUnique(peopleIdentifiers)
  // Aggregate counts
  const [docCount] = await platformDb
    .select({ count: count() })
    .from(documents)
    .where(inArray(documents.orgId, entityIds))
  const [actionCount] = await platformDb
    .select({ count: count() })
    .from(governanceActions)
    .where(inArray(governanceActions.orgId, entityIds))
  const [auditCount] = await platformDb
    .select({ count: count() })
    .from(auditEvents)
    .where(inArray(auditEvents.orgId, entityIds))
  const [ledgerCount] = await platformDb
    .select({ count: count() })
    .from(shareLedgerEntries)
    .where(inArray(shareLedgerEntries.orgId, entityIds))
  const [resolutionCount] = await platformDb
    .select({ count: count() })
    .from(resolutions)
    .where(inArray(resolutions.orgId, entityIds))
  const [meetingCount] = await platformDb
    .select({ count: count() })
    .from(meetings)
    .where(inArray(meetings.orgId, entityIds))
  return {
    status: 200,
    body: {
      orgs: entityIds.length,
      uniqueShareholders: {
        count: toNumber(uniqueShareholdersEstimate.estimate),
        precision: uniqueShareholdersEstimate.precision,
        standardError: uniqueShareholdersEstimate.standardError,
      },
      uniquePeople: {
        count: toNumber(uniquePeopleEstimate.estimate),
        precision: uniquePeopleEstimate.precision,
        standardError: uniquePeopleEstimate.standardError,
      },
      totalDocuments: toNumber(docCount?.count),
      totalActions: toNumber(actionCount?.count),
      totalAuditEvents: toNumber(auditCount?.count),
      totalLedgerEntries: toNumber(ledgerCount?.count),
      totalResolutions: toNumber(resolutionCount?.count),
      totalMeetings: toNumber(meetingCount?.count),
      entityBreakdown: userEntities.map((e) => ({
        id: e.id,
        name: e.legalName,
        jurisdiction: e.jurisdiction,
        status: e.status,
      })),
    },
  }
}

export async function listUserApprovals(userId: string) {
  // Get all approvals from orgs the user has access to
  const rows = await platformDb
    .select({
      id: approvals.id,
      orgId: approvals.orgId,
      entityName: orgs.legalName,
      subjectType: approvals.subjectType,
      subjectId: approvals.subjectId,
      approvalType: approvals.approvalType,
      threshold: approvals.threshold,
      status: approvals.status,
      decidedAt: approvals.decidedAt,
      notes: approvals.notes,
      createdAt: approvals.createdAt,
    })
    .from(approvals)
    .innerJoin(orgs, eq(orgs.id, approvals.orgId))
    .innerJoin(
      orgMembers,
      and(
        eq(orgMembers.orgId, approvals.orgId),
        eq(orgMembers.userId, userId),
        eq(orgMembers.status, 'active'),
      ),
    )
    .orderBy(desc(approvals.createdAt))
  return {
    status: 200,
    body: rows,
  }
}

export async function readMemberCostRollups(userId: string) {
  const memberships = await platformDb
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.status, 'active')))
  const orgIds = memberships.map((m) => m.orgId)
  if (orgIds.length === 0) {
    return {
      status: 200,
      body: { rollups: [] },
    }
  }
  const sinceDay = isoDayOffset(29)
  const rollups = await platformDb
    .select({
      orgId: platformCostRollups.orgId,
      appId: platformCostRollups.appId,
      category: platformCostRollups.category,
      day: platformCostRollups.day,
      totalUnits: platformCostRollups.totalUnits,
      totalEstCostUsd: platformCostRollups.totalEstCostUsd,
      eventCount: platformCostRollups.eventCount,
    })
    .from(platformCostRollups)
    .where(and(inArray(platformCostRollups.orgId, orgIds), gte(platformCostRollups.day, sinceDay)))
    .orderBy(asc(platformCostRollups.day))
  return {
    status: 200,
    body: { rollups },
  }
}
