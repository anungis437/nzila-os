/** Grievance import domain operations. The route supplies its authenticated
 * tenant transaction for every row/session unit; helpers never open another
 * connection or commit independently of the mandatory audit and pilot events.
 */
import { z } from 'zod'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { grievances } from '@/db/schema/domains/claims/grievances'
import { grievanceEvents } from '@/db/schema/domains/claims/grievance-lifecycle'
import { ingestionBatches, ingestionRecords } from '@/db/schema/ingestion-schema'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { trackPilotEvent } from '@/lib/services/pilot-tracking'
import { randomBytes, createHash } from 'crypto'
import { and, desc, eq, ne, or, sql } from 'drizzle-orm'

const recordInOrganization = (organizationId: string) =>
  sql`${ingestionRecords.batchId} IN (SELECT id FROM public.ingestion_batches WHERE organization_id = ${organizationId})`

const grievanceTypeValues = [
  'individual',
  'group',
  'policy',
  'contract',
  'harassment',
  'discrimination',
  'safety',
  'seniority',
  'discipline',
  'termination',
  'other',
] as const

const importItemSchema = z.object({
  type: z.enum(grievanceTypeValues).default('other'),
  title: z.string().min(5).max(500),
  description: z.string().min(10).max(10_000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  grievantName: z.string().max(255).optional(),
  grievantEmail: z.string().email().max(255).optional(),
  employerName: z.string().max(255).optional(),
  workplaceName: z.string().max(255).optional(),
  cbaArticle: z.string().max(100).optional(),
  cbaSection: z.string().max(100).optional(),
  incidentDate: z.string().datetime({ offset: true }).optional().or(z.string().date().optional()),
  desiredOutcome: z.string().max(5_000).optional(),
  createOfficialCase: z.boolean().optional(),
})

type MappedImportRow = ReturnType<typeof mapImportRowToCanonical>

function coerceExternalId(row: Record<string, unknown>): string | null {
  const candidate =
    row.externalId ?? row.external_id ?? row.caseId ?? row.case_id ?? row.reference ?? null
  const value = candidate ? String(candidate).trim() : ''
  return value.length > 0 ? value : null
}

function computeFingerprint(row: MappedImportRow): string {
  const payload = {
    type: row.type,
    title: row.title.trim().toLowerCase(),
    description: row.description.trim().toLowerCase(),
    grievantEmail: (row.grievantEmail ?? '').trim().toLowerCase(),
    incidentDate: row.incidentDate ?? null,
    employerName: (row.employerName ?? '').trim().toLowerCase(),
    workplaceName: (row.workplaceName ?? '').trim().toLowerCase(),
  }

  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function mapImportRowToCanonical(row: Record<string, unknown>, defaultCreateOfficialCase: boolean) {
  const typeCandidate = String(row.type ?? row.case_type ?? row.category ?? 'other').toLowerCase()
  const type = grievanceTypeValues.includes(typeCandidate as (typeof grievanceTypeValues)[number])
    ? (typeCandidate as (typeof grievanceTypeValues)[number])
    : 'other'

  return {
    type,
    title: String(row.title ?? row.case_title ?? row.subject ?? '').trim(),
    description: String(row.description ?? row.details ?? row.summary ?? '').trim(),
    priority: row.priority ? String(row.priority).toLowerCase() : undefined,
    grievantName: row.grievantName
      ? String(row.grievantName)
      : row.grievant_name
        ? String(row.grievant_name)
        : undefined,
    grievantEmail: row.grievantEmail
      ? String(row.grievantEmail)
      : row.grievant_email
        ? String(row.grievant_email)
        : undefined,
    employerName: row.employerName
      ? String(row.employerName)
      : row.employer_name
        ? String(row.employer_name)
        : undefined,
    workplaceName: row.workplaceName
      ? String(row.workplaceName)
      : row.workplace_name
        ? String(row.workplace_name)
        : undefined,
    cbaArticle: row.cbaArticle
      ? String(row.cbaArticle)
      : row.cba_article
        ? String(row.cba_article)
        : undefined,
    cbaSection: row.cbaSection
      ? String(row.cbaSection)
      : row.cba_section
        ? String(row.cba_section)
        : undefined,
    incidentDate: row.incidentDate
      ? String(row.incidentDate)
      : row.incident_date
        ? String(row.incident_date)
        : undefined,
    desiredOutcome: row.desiredOutcome
      ? String(row.desiredOutcome)
      : row.desired_outcome
        ? String(row.desired_outcome)
        : undefined,
    createOfficialCase:
      typeof row.createOfficialCase === 'boolean'
        ? row.createOfficialCase
        : typeof row.create_official_case === 'boolean'
          ? row.create_official_case
          : defaultCreateOfficialCase,
  }
}

type RowOutcome =
  | { kind: 'duplicate'; existingGrievanceId: string }
  | { kind: 'invalid'; reason: string }
  | {
      kind: 'imported'
      grievanceId: string
      grievanceNumber: string
      mode: 'official_case' | 'intake'
    }

/**
 * One source row, in one organization transaction: its ingestion record, the duplicate check, the case it becomes, the audit of that and the
 * record's final state commit together, so a row is either fully imported (and resumable as such) or not recorded at all.
 */
export async function importGrievanceRow(
  tx: RLSTx,
  input: {
    organizationId: string
    userId: string
    batchId: string
    sourceSystem: string
    index: number
    source: Record<string, unknown>
    defaultCreateOfficialCase: boolean
  },
): Promise<RowOutcome> {
  const { organizationId, userId, batchId, sourceSystem, index, source } = input
  const mapped = mapImportRowToCanonical(source, input.defaultCreateOfficialCase)
  const externalId = coerceExternalId(source)
  const fingerprint = computeFingerprint(mapped)

  const [record] = await tx
    .insert(ingestionRecords)
    .values({
      batchId,
      recordIndex: index,
      recordType: 'grievance',
      externalId,
      status: 'pending',
      fingerprint,
    })
    .returning({ id: ingestionRecords.id })

  await trackPilotEvent(
    {
      userId,
      organizationId,
      sessionId: `server:grievance-import`,
      eventType: 'mapping_applied',
      metadata: { rowIndex: index, mode: mapped.createOfficialCase ? 'official_case' : 'intake' },
    },
    tx,
  )

  // A duplicate is a row of this organization's earlier imports from the same source system that already succeeded, with the same external id or content.
  const [duplicate] = await tx
    .select({ resolvedId: ingestionRecords.resolvedId })
    .from(ingestionRecords)
    .innerJoin(ingestionBatches, eq(ingestionBatches.id, ingestionRecords.batchId))
    .where(
      and(
        eq(ingestionBatches.organizationId, organizationId),
        eq(ingestionBatches.sourceSystem, sourceSystem),
        eq(ingestionRecords.recordType, 'grievance'),
        ne(ingestionRecords.id, record.id),
        eq(ingestionRecords.status, 'succeeded'),
        or(
          externalId ? eq(ingestionRecords.externalId, externalId) : undefined,
          eq(ingestionRecords.fingerprint, fingerprint),
        ),
      ),
    )
    .orderBy(desc(ingestionRecords.createdAt))
    .limit(1)

  if (duplicate?.resolvedId) {
    await tx
      .update(ingestionRecords)
      .set({
        status: 'skipped',
        errorMessage: 'Duplicate row already imported',
        resolvedId: duplicate.resolvedId,
        processedAt: new Date(),
      })
      .where(and(eq(ingestionRecords.id, record.id), recordInOrganization(organizationId)))

    return { kind: 'duplicate', existingGrievanceId: duplicate.resolvedId }
  }

  const validated = importItemSchema.safeParse(mapped)
  if (!validated.success) {
    const reason = validated.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')

    await tx
      .update(ingestionRecords)
      .set({
        status: 'failed',
        errorMessage: reason,
        errorDetails: { issues: validated.error.issues },
        processedAt: new Date(),
      })
      .where(and(eq(ingestionRecords.id, record.id), recordInOrganization(organizationId)))

    await trackPilotEvent(
      {
        userId,
        organizationId,
        sessionId: `server:grievance-import`,
        eventType: 'validation_failed',
        metadata: { rowIndex: index, reason },
      },
      tx,
    )

    return { kind: 'invalid', reason }
  }

  const row = validated.data
  const mode = row.createOfficialCase ? 'official_case' : 'intake'

  const grievanceNumber = `GRV-IMP-${Date.now()}-${randomBytes(3).toString('hex')}`
  const [g] = await tx
    .insert(grievances)
    .values({
      grievanceNumber,
      type: row.type,
      title: row.title,
      description: row.description,
      priority: row.createOfficialCase ? (row.priority ?? 'medium') : 'low',
      status: row.createOfficialCase ? 'filed' : 'draft',
      organizationId,
      createdBy: userId,
      filedDate: row.createOfficialCase ? new Date() : null,
      grievantName: row.grievantName ?? null,
      grievantEmail: row.grievantEmail ?? null,
      employerName: row.employerName ?? null,
      workplaceName: row.workplaceName ?? null,
      cbaArticle: row.cbaArticle ?? null,
      cbaSection: row.cbaSection ?? null,
      incidentDate: row.incidentDate ? new Date(row.incidentDate) : null,
      desiredOutcome: row.desiredOutcome ?? null,
      isGroupGrievance: row.type === 'group',
    })
    .returning()

  await tx.insert(grievanceEvents).values({
    grievanceId: g.id,
    eventType: row.createOfficialCase ? 'created' : 'intake_submitted',
    actorUserId: userId,
    notes: row.createOfficialCase
      ? 'Case imported via governed ingestion'
      : 'Intake imported via governed ingestion',
  })

  // Each imported row commits together with its audit record.
  await persistAtomicAudit(tx, {
    organizationId,
    userId,
    action: 'grievance.import_row',
    resourceType: 'grievances',
    resourceId: g.id,
    details: {
      operation: 'bulk_import',
      grievanceNumber: g.grievanceNumber,
      status: g.status,
      mode,
    },
  })

  await trackPilotEvent(
    {
      userId,
      organizationId,
      sessionId: `server:grievance-import`,
      eventType: 'case_imported',
      metadata: {
        grievanceId: g.id,
        grievanceNumber: g.grievanceNumber,
        mode,
      },
    },
    tx,
  )

  if (row.createOfficialCase) {
    await trackPilotEvent(
      {
        userId,
        organizationId,
        sessionId: `server:grievance-import`,
        eventType: 'case_created',
        metadata: { grievanceId: g.id, source: 'governed_import' },
      },
      tx,
    )
  }

  await tx
    .update(ingestionRecords)
    .set({
      status: 'succeeded',
      resolvedId: g.id,
      processedAt: new Date(),
    })
    .where(and(eq(ingestionRecords.id, record.id), recordInOrganization(organizationId)))

  return { kind: 'imported', grievanceId: g.id, grievanceNumber: g.grievanceNumber, mode }
}

export interface BatchTally {
  total: number
  processed: number
  succeeded: number
  failed: number
  skipped: number
  errors: Array<{ rowIndex: number; reason: string }>
}

/** The session status and its audit commit together. A failed audit leaves the session running. */
export async function finalizeGrievanceImportBatch(
  tx: RLSTx,
  organizationId: string,
  userId: string,
  batchId: string,
  sourceSystem: string,
  status: 'completed' | 'partial' | 'failed',
  tally: BatchTally,
  imported: number,
) {
  await tx
    .update(ingestionBatches)
    .set({
      status,
      totalRecords: tally.total,
      processed: tally.processed,
      succeeded: tally.succeeded,
      failed: tally.failed,
      skipped: tally.skipped,
      completedAt: new Date(),
      errorSummary: tally.errors,
    })
    .where(
      and(eq(ingestionBatches.id, batchId), eq(ingestionBatches.organizationId, organizationId)),
    )

  await persistAtomicAudit(tx, {
    organizationId,
    userId,
    action: 'grievance.import_batch',
    resourceType: 'ingestion_batches',
    resourceId: batchId,
    details: {
      importSessionId: batchId,
      sourceSystem,
      totalRows: tally.total,
      importedRows: imported,
      skippedRows: tally.skipped,
      failedRows: tally.failed,
    },
  })
}

export async function openGrievanceImportSession(
  tx: RLSTx,
  input: {
    organizationId: string
    userId: string
    requestedSession?: string
    sourceSystem: string
    totalRows: number
    format: 'json' | 'csv'
    resumeFailedOnly: boolean
  },
) {
  const {
    organizationId,
    userId,
    requestedSession,
    sourceSystem,
    totalRows,
    format,
    resumeFailedOnly,
  } = input
  if (requestedSession) {
    const [existingBatch] = await tx
      .select({ id: ingestionBatches.id })
      .from(ingestionBatches)
      .where(
        and(
          eq(ingestionBatches.id, requestedSession),
          eq(ingestionBatches.organizationId, organizationId),
        ),
      )
      .limit(1)
    if (!existingBatch) return null
  }

  const batchId = requestedSession
    ? requestedSession
    : (
        await tx
          .insert(ingestionBatches)
          .values({
            organizationId,
            sourceSystem,
            status: 'running',
            totalRecords: totalRows,
            processed: 0,
            succeeded: 0,
            failed: 0,
            skipped: 0,
            startedAt: new Date(),
            createdBy: userId,
            metadata: {
              format: format,
              resumeFailedOnly: resumeFailedOnly,
            },
          })
          .returning({ id: ingestionBatches.id })
      )[0].id

  const processedIndexes = resumeFailedOnly
    ? new Set(
        (
          await tx
            .select({ recordIndex: ingestionRecords.recordIndex })
            .from(ingestionRecords)
            .where(
              and(eq(ingestionRecords.batchId, batchId), eq(ingestionRecords.status, 'succeeded')),
            )
        ).map((r) => r.recordIndex),
      )
    : new Set<number>()

  return { batchId, processedIndexes }
}

export function listGrievanceImportSessions(tx: RLSTx, organizationId: string) {
  return tx
    .select()
    .from(ingestionBatches)
    .where(eq(ingestionBatches.organizationId, organizationId))
    .orderBy(sql`${ingestionBatches.createdAt} DESC`)
    .limit(25)
}

export async function readGrievanceImportSession(
  tx: RLSTx,
  organizationId: string,
  sessionId: string,
) {
  const [batch] = await tx
    .select()
    .from(ingestionBatches)
    .where(
      and(eq(ingestionBatches.id, sessionId), eq(ingestionBatches.organizationId, organizationId)),
    )
    .limit(1)
  if (!batch) return null
  const records = await tx
    .select()
    .from(ingestionRecords)
    .where(and(eq(ingestionRecords.batchId, sessionId), recordInOrganization(organizationId)))
    .orderBy(sql`${ingestionRecords.recordIndex} ASC`)
  return { session: batch, records }
}
