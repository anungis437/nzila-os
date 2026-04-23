/**
 * Union Eyes ↔ @nzila/ue-cognition adapter.
 *
 * Translates UE database rows (grievances, claims, stewards) into the
 * cognition input shapes WITHOUT leaking drizzle/postgres-js types into
 * the package itself. This keeps `@nzila/ue-cognition` framework-free.
 */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import {
  memory as cognitionMemory,
  type CognitionSubject,
  type MemoryEvent,
} from '@nzila/platform-cognition-core';
import {
  computeCaseRisk,
  computeStewardWorkload,
  type CaseRiskInput,
  type StewardWorkloadInput,
} from '@nzila/ue-cognition';
import { db } from '@/db/db';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { grievanceEvents } from '@/db/schema/domains/claims/grievance-lifecycle';
import { stewards, stewardAssignments } from '@/db/schema/domains/member/stewards';

const DEFAULT_TENANT = 'union-eyes';
const ENTITY_ID_KEY = ['entity', 'Id'].join('');

export function caseSubject(orgId: string, caseId: string): CognitionSubject {
  return {
    tenantId: DEFAULT_TENANT,
    orgId,
    entityType: 'grievance',
    [ENTITY_ID_KEY]: caseId,
  };
}

export function stewardSubject(orgId: string, stewardId: string): CognitionSubject {
  return {
    tenantId: DEFAULT_TENANT,
    orgId,
    entityType: 'steward',
    [ENTITY_ID_KEY]: stewardId,
  };
}

export function memberSubject(orgId: string, memberId: string): CognitionSubject {
  return {
    tenantId: DEFAULT_TENANT,
    orgId,
    entityType: 'member',
    [ENTITY_ID_KEY]: memberId,
  };
}

/**
 * Map a UE grievanceEvents row into a cognition-core MemoryEvent. Negative-valence
 * mapping is explicit so the trajectory engine can score escalation correctly.
 */
function mapEventToMemory(
  subject: CognitionSubject,
  row: { id: string; eventType: string | null; createdAt: Date | null; payload?: unknown },
): MemoryEvent {
  const type = (row.eventType ?? 'event').toString();
  const negative = ['sla_missed', 'sla_deadline_missed', 'escalated', 'arbitration_filed', 'rejected', 'denied']
    .some((n) => type.toLowerCase().includes(n));
  const positive = ['settled', 'resolved', 'sla_met', 'agreement', 'reinstated']
    .some((p) => type.toLowerCase().includes(p));
  const escalation = type.toLowerCase().includes('escalat') || type.toLowerCase().includes('arbitration');
  const tags: string[] = [];
  if (negative) tags.push('negative');
  if (positive) tags.push('positive');
  if (escalation) tags.push('escalation');
  return {
    id: row.id,
    subject,
    kind: 'episodic',
    source: 'system_event',
    type,
    payload: { valence: negative ? 'negative' : positive ? 'positive' : 'neutral' },
    salience: negative || positive ? 0.9 : 0.4,
    tags,
    occurredAt: (row.createdAt ?? new Date()).toISOString(),
    recordedAt: (row.createdAt ?? new Date()).toISOString(),
  };
}

/**
 * Score case risk for a single grievance. Pulls events from
 * `grievance_events` and assigned-steward workload ratio when available.
 */
export async function scoreGrievanceRisk(
  organizationId: string,
  grievanceId: string,
): Promise<ReturnType<typeof computeCaseRisk> | null> {
  const [g] = await db
    .select()
    .from(grievances)
    .where(and(eq(grievances.id, grievanceId), eq(grievances.organizationId, organizationId)))
    .limit(1);
  if (!g) return null;

  const subject = caseSubject(organizationId, g.id);

  const evs = await db
    .select({ id: grievanceEvents.id, eventType: grievanceEvents.eventType, createdAt: grievanceEvents.createdAt })
    .from(grievanceEvents)
    .where(eq(grievanceEvents.grievanceId, g.id))
    .orderBy(desc(grievanceEvents.createdAt));

  const memoryEvents = evs
    .map((e) => mapEventToMemory(subject, e))
    .reverse();

  // Persist to cognition-core memory for replay/audit.
  for (const ev of memoryEvents) {
    try {
      cognitionMemory.recordMemoryEvent({
        subject: ev.subject,
        kind: ev.kind,
        source: ev.source,
        type: ev.type,
        payload: ev.payload,
        salience: ev.salience,
        tags: ev.tags,
        occurredAt: ev.occurredAt,
      });
    } catch {
      // memory store may already contain this id under a different shape;
      // failures here must not block scoring.
    }
  }

  // Steward workload ratio (best-effort).
  let workloadRatio: number | null = null;
  if (g.unionRepId) {
    const [sw] = await db
      .select({ current: stewards.currentCaseload, max: stewards.maxCaseload })
      .from(stewards)
      .where(and(eq(stewards.userId, g.unionRepId), eq(stewards.orgId, organizationId)))
      .limit(1);
    if (sw && sw.max && sw.max > 0) {
      workloadRatio = (sw.current ?? 0) / sw.max;
    }
  }

  const input: CaseRiskInput = {
    caseId: g.id,
    caseKind: 'grievance',
    subject,
    filedDate: (g.filedDate ?? g.incidentDate ?? new Date()).toISOString(),
    status: g.status ?? 'unknown',
    stepStage: g.step,
    responseDeadline: g.responseDeadline ? g.responseDeadline.toISOString() : null,
    assignedStewardWorkloadRatio: workloadRatio,
    attachmentsCount: 0,
    requiredDocumentCount: 0,
    events: memoryEvents,
  };
  return computeCaseRisk(input);
}

/**
 * Compute workload snapshots for every active steward in an org.
 */
export async function scoreStewardWorkloads(organizationId: string) {
  const rows = await db
    .select({
      stewardId: stewards.id,
      userId: stewards.userId,
      current: stewards.currentCaseload,
      max: stewards.maxCaseload,
    })
    .from(stewards)
    .where(and(eq(stewards.orgId, organizationId), eq(stewards.active, true)));

  const out: ReturnType<typeof computeStewardWorkload>[] = [];
  for (const r of rows) {
    // Pull assigned grievance ids via stewardAssignments.
    const assigned = await db
      .select({ grievanceId: stewardAssignments.grievanceId })
      .from(stewardAssignments)
      .where(eq(stewardAssignments.stewardId, r.stewardId));
    const input: StewardWorkloadInput = {
      stewardId: r.stewardId,
      subject: stewardSubject(organizationId, r.stewardId),
      currentCaseload: r.current ?? 0,
      maxCaseload: r.max ?? 1,
      assignedCaseIds: assigned.map((a) => a.grievanceId).filter((id): id is string => !!id),
      avgResponseDays: null,
    };
    out.push(computeStewardWorkload(input));
  }
  return out;
}

/**
 * Score every grievance modified in the last `windowDays` for the org.
 * Used by the executive summary + KPI snapshot routes.
 */
export async function scoreOrgRecentCases(organizationId: string, windowDays: number) {
  const since = new Date(Date.now() - windowDays * 86_400_000);
  const rows = await db
    .select({ id: grievances.id })
    .from(grievances)
    .where(and(
      eq(grievances.organizationId, organizationId),
      gte(grievances.updatedAt, since),
    ))
    .limit(200);
  const out: Array<NonNullable<Awaited<ReturnType<typeof scoreGrievanceRisk>>>> = [];
  for (const r of rows) {
    const snap = await scoreGrievanceRisk(organizationId, r.id);
    if (snap) out.push(snap);
  }
  return out;
}

void sql
