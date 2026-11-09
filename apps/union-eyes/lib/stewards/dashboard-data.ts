/**
 * What the representative (steward) supervision dashboard shows, read inside the organization's own transaction.
 *
 * The page used to read these tables through the module-level database handle with no organization set, so the runtime role saw
 * no steward and no grievance, and a database failure was logged and rendered as zeros. Here every statement runs in
 * withRLSContext({ organizationId }) and a failure is thrown to the page.
 */
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { grievances, stewards } from '@/db/schema';
import { organizationMembers } from '@/db/schema-organizations';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { productionGrievanceCondition } from '@/lib/pilot/demo-provenance';

/** Statuses present in the live grievance status column that end a case. */
const TERMINAL_STATUSES = ['closed', 'settled', 'withdrawn', 'denied'] as const;
const terminal = sql.join(TERMINAL_STATUSES.map((status) => sql`${status}`), sql`, `);

export const UNKNOWN_NAME = 'Unknown';
export const UNASSIGNED = 'Unassigned';

export interface StewardsDashboard {
  stats: {
    totalStewards: number;
    activeCases: number;
    pendingEscalations: number;
    completedThisMonth: number;
    /** Closed cases as a share of the cases filed (drafts excluded), in whole percent. */
    successRate: number;
  };
  workload: Array<{ name: string; active: number; capacityFreePercent: number }>;
  escalations: Array<{ id: string; member: string; steward: string; reason: string }>;
}

export function loadStewardsDashboard(organizationId: string, now: Date = new Date()): Promise<StewardsDashboard> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return withRLSContext({ organizationId }, async (tx) => {
    const activeStewards = and(eq(stewards.orgId, organizationId), eq(stewards.active, true));
    const inOrganization = and(eq(grievances.organizationId, organizationId), productionGrievanceCondition());

    const [{ total: totalStewards, caseload }] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        caseload: sql<number>`coalesce(sum(${stewards.currentCaseload}), 0)::int`,
      })
      .from(stewards)
      .where(activeStewards);

    const [{ escalated, completedThisMonth, closed, filed }] = await tx
      .select({
        escalated: sql<number>`count(*) filter (where ${grievances.status}::text = 'escalated')::int`,
        completedThisMonth: sql<number>`count(*) filter (where ${grievances.status}::text in (${terminal}) and coalesce(${grievances.closedAt}, ${grievances.resolvedAt}) >= ${monthStart.toISOString()}::timestamptz)::int`,
        closed: sql<number>`count(*) filter (where ${grievances.status}::text in (${terminal}))::int`,
        filed: sql<number>`count(*) filter (where ${grievances.status}::text <> 'draft')::int`,
      })
      .from(grievances)
      .where(inOrganization);

    const stewardRows = await tx
      .select({ userId: stewards.userId, active: stewards.currentCaseload, maxCaseload: stewards.maxCaseload })
      .from(stewards)
      .where(activeStewards)
      .orderBy(desc(stewards.currentCaseload));

    const escalationRows = await tx
      .select({
        grievanceId: grievances.id,
        grievanceNumber: grievances.grievanceNumber,
        grievantName: grievances.grievantName,
        title: grievances.title,
        unionRepId: grievances.unionRepId,
      })
      .from(grievances)
      .where(and(inOrganization, sql`${grievances.status}::text = 'escalated'`))
      .orderBy(grievances.escalatedAt)
      .limit(50);

    // stewards.userId and grievances.unionRepId are uuids that may match organization_members.id or organization_members.userId.
    const wanted = [...new Set([...stewardRows.map((row) => row.userId), ...escalationRows.map((row) => row.unionRepId)].filter((id): id is string => !!id))];
    const names = new Map<string, string>();
    if (wanted.length > 0) {
      const members = await tx
        .select({ id: organizationMembers.id, userId: organizationMembers.userId, name: organizationMembers.name })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, organizationId), or(inArray(organizationMembers.id, wanted), inArray(organizationMembers.userId, wanted))));
      for (const member of members) {
        if (member.id) names.set(member.id, member.name ?? UNKNOWN_NAME);
        if (member.userId) names.set(member.userId, member.name ?? UNKNOWN_NAME);
      }
    }

    return {
      stats: {
        totalStewards,
        activeCases: caseload,
        pendingEscalations: escalated,
        completedThisMonth,
        successRate: filed > 0 ? Math.round((closed / filed) * 100) : 0,
      },
      workload: stewardRows.map((row) => ({
        name: names.get(row.userId) ?? UNKNOWN_NAME,
        active: row.active,
        capacityFreePercent: row.maxCaseload > 0 ? Math.round(((row.maxCaseload - row.active) / row.maxCaseload) * 100) : 0,
      })),
      escalations: escalationRows.map((row) => ({
        id: row.grievanceNumber ?? row.grievanceId,
        member: row.grievantName ?? UNKNOWN_NAME,
        steward: row.unionRepId ? (names.get(row.unionRepId) ?? UNKNOWN_NAME) : UNASSIGNED,
        reason: row.title ?? '',
      })),
    };
  });
}
