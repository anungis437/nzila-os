/**
 * Server-only repo: reads CUPE 4373 demo cases from the demo Postgres DB.
 *
 * This is the Gap 1 closure for the Cases vertical. Grievances are the
 * canonical home for the rich demo content (title/timeline/attachments);
 * the original demo-specific fields (caseworkStream, urgencyLabel,
 * agreementRefs, etc.) round-trip through a synthetic `_demo-meta.json`
 * attachment seeded by `scripts/seed-cupe4373-demo.ts`.
 *
 * Read-path is feature-flagged: `UE_DEMO_DATA_SOURCE=db` opts in. When
 * the flag is unset or DB read fails, callers fall back to the static
 * `demoCases` array so local dev (no DATABASE_URL) still works.
 *
 * Blueprint note: nothing in this file is CUPE-specific. The seeded
 * organization ID is the only knob and is keyed off
 * `NZILA_FOUNDATION_ORG_ID` (default: the CUPE 4373 stable UUID).
 */

import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { createLogger } from '@nzila/os-core/telemetry';

import { db } from '@/db/db';
import { grievances } from '@/db/schema/grievance-schema';
import {
  demoCases as staticDemoCases,
  type DemoCase,
  type DemoTimelineEntry,
} from '@/lib/demo/cupe4373-demo';

const log = createLogger('cupe4373-cases-repo');

const DEFAULT_FOUNDATION_ORG_ID = 'a4373000-0000-4000-8000-000000000001';
const FOUNDATION_ORG_ID =
  process.env.NZILA_FOUNDATION_ORG_ID ?? DEFAULT_FOUNDATION_ORG_ID;

function shouldUseDb(): boolean {
  if (process.env.UE_DEMO_DATA_SOURCE === 'db') return true;
  // Default-on when DATABASE_URL points at the demo DB (host contains "demo-db")
  if (process.env.DATABASE_URL?.includes('demo-db')) return true;
  return false;
}

type DemoMeta = {
  caseworkStream: DemoCase['caseworkStream'];
  worker: string;
  unit: string;
  location: string;
  assignedSteward: string;
  urgencyLabel: DemoCase['urgency'];
  statusLabel: string;
  agreementRefs: string[];
  continuityState: string;
  nextStep: string;
  relatedCases: string[];
  flags: string[];
  notes: string[];
};

type SeededAttachment = {
  id: string;
  name: string;
  url: string;
  type: string;
  uploadedAt: string;
  _demoMeta?: DemoMeta;
};

type SeededTimelineEntry = {
  date: string;
  action: string;
  actor: string;
  notes?: string;
  attachments?: string[];
  followUp?: string;
  entryId?: string;
};

/**
 * IMPORTANT: The live demo DB was restored from a Django snapshot that
 * predates several columns present in the Drizzle schema
 * (accommodation_flag, workplace_safety_flag, member_phone, etc.).
 * A plain `db.select().from(grievances)` would fail because Drizzle
 * selects every schema column explicitly. We project only the columns
 * we actually need to reconstruct a DemoCase.
 */
const grievanceProjection = {
  id: grievances.id,
  grievanceNumber: grievances.grievanceNumber,
  type: grievances.type,
  status: grievances.status,
  priority: grievances.priority,
  step: grievances.step,
  grievantName: grievances.grievantName,
  employerName: grievances.employerName,
  workplaceName: grievances.workplaceName,
  cbaArticle: grievances.cbaArticle,
  title: grievances.title,
  description: grievances.description,
  background: grievances.background,
  desiredOutcome: grievances.desiredOutcome,
  filedDate: grievances.filedDate,
  responseDeadline: grievances.responseDeadline,
  timeline: grievances.timeline,
  attachments: grievances.attachments,
  organizationId: grievances.organizationId,
  createdAt: grievances.createdAt,
  updatedAt: grievances.updatedAt,
} as const;

type GrievanceRow = {
  id: string;
  grievanceNumber: string;
  type: string;
  status: string;
  priority: string | null;
  step: string | null;
  grievantName: string | null;
  employerName: string | null;
  workplaceName: string | null;
  cbaArticle: string | null;
  title: string;
  description: string;
  background: string | null;
  desiredOutcome: string | null;
  filedDate: Date | null;
  responseDeadline: Date | null;
  timeline: unknown;
  attachments: unknown;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

function reconstructDemoCase(row: GrievanceRow): DemoCase {
  const attachments = (Array.isArray(row.attachments) ? row.attachments : []) as SeededAttachment[];
  const meta = attachments.find((a) => a?._demoMeta)?._demoMeta;
  const realAttachments = attachments.filter((a) => !a?._demoMeta).map((a) => a.name);

  const timeline: DemoTimelineEntry[] = (
    Array.isArray(row.timeline) ? (row.timeline as SeededTimelineEntry[]) : []
  ).map((t, idx) => ({
    id: t.entryId ?? `tl-${row.grievanceNumber}-${idx + 1}`,
    timestamp: t.date,
    actor: t.actor,
    action: t.action,
    notes: t.notes ?? '',
    attachments: t.attachments ?? [],
    followUp: t.followUp ?? '',
  }));

  return {
    id: row.grievanceNumber,
    title: row.title,
    type: meta ? deriveTypeLabel(meta) : row.type,
    caseworkStream: meta?.caseworkStream ?? 'grievance',
    worker: meta?.worker ?? row.grievantName ?? 'Unknown',
    unit: meta?.unit ?? 'Unknown unit',
    location: meta?.location ?? row.workplaceName ?? '',
    status: meta?.statusLabel ?? row.status,
    urgency: meta?.urgencyLabel ?? mapPriorityToUrgency(row.priority),
    assignedSteward: meta?.assignedSteward ?? 'Unassigned',
    opened: row.filedDate?.toISOString() ?? row.createdAt.toISOString(),
    updated: row.updatedAt.toISOString(),
    deadline: row.responseDeadline?.toISOString() ?? row.createdAt.toISOString(),
    summary: row.description,
    desiredOutcome: row.desiredOutcome ?? '',
    agreementRefs: meta?.agreementRefs ?? (row.cbaArticle ? [row.cbaArticle] : []),
    continuityState: meta?.continuityState ?? row.background ?? '',
    nextStep: meta?.nextStep ?? '',
    relatedCases: meta?.relatedCases ?? [],
    attachments: realAttachments,
    flags: meta?.flags ?? [],
    notes: meta?.notes ?? [],
    timeline,
  };
}

function deriveTypeLabel(meta: DemoMeta): string {
  // Demo content originally has rich free-text type labels; if missing,
  // synthesize one from caseworkStream so the UI never shows enum slugs.
  switch (meta.caseworkStream) {
    case 'grievance':
      return 'Grievance';
    case 'accommodation':
      return 'Accommodation request';
    case 'health-safety':
      return 'Health & safety';
    case 'coordination':
      return 'Coordination';
    default:
      return 'Casework';
  }
}

function mapPriorityToUrgency(p: string | null): DemoCase['urgency'] {
  if (p === 'urgent') return 'urgent';
  if (p === 'high') return 'watch';
  return 'steady';
}

export async function getDemoCasesFromDb(): Promise<DemoCase[]> {
  if (!shouldUseDb()) return staticDemoCases;
  try {
    const rows = await db
      .select(grievanceProjection)
      .from(grievances)
      .where(eq(grievances.organizationId, FOUNDATION_ORG_ID))
      .orderBy(desc(grievances.priority), desc(grievances.responseDeadline));
    if (rows.length === 0) return staticDemoCases;
    return rows.map(reconstructDemoCase);
  } catch (err) {
    log.warn('DB read failed, falling back to static', { error: err });
    return staticDemoCases;
  }
}

export async function getDemoCaseFromDb(id: string): Promise<DemoCase | null> {
  if (!shouldUseDb()) {
    return staticDemoCases.find((c) => c.id === id) ?? null;
  }
  try {
    const rows = await db
      .select(grievanceProjection)
      .from(grievances)
      .where(
        and(
          eq(grievances.organizationId, FOUNDATION_ORG_ID),
          eq(grievances.grievanceNumber, id),
        ),
      )
      .limit(1);
    if (rows.length === 0) {
      return staticDemoCases.find((c) => c.id === id) ?? null;
    }
    return reconstructDemoCase(rows[0]);
  } catch (err) {
    log.warn('DB read failed for case', { caseId: id, error: err });
    return staticDemoCases.find((c) => c.id === id) ?? null;
  }
}
