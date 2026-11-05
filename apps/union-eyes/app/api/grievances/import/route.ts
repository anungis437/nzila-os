import { z } from 'zod';
import { NextResponse } from 'next/server';
import { readBoundedJson, RequestBodyTooLargeError } from '@/lib/api/bounded-json';
import { db } from '@/db/db';
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { grievanceEvents } from '@/db/schema/domains/claims/grievance-lifecycle';
import { ingestionBatches, ingestionRecords } from '@/db/schema/ingestion-schema';
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { hasCaseFilingCapacity } from '@/lib/cases/case-authorization';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { trackPilotEvent } from '@/lib/services/pilot-tracking';
import { logger } from '@/lib/logger';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';
import { randomBytes, createHash } from 'crypto';
import { and, desc, eq, ne, or, sql } from 'drizzle-orm';

// ingestion_records has no organization column: a record belongs to its batch, and the batch to an organization.
const recordInOrganization = (organizationId: string) =>
  sql`${ingestionRecords.batchId} IN (SELECT id FROM ingestion_batches WHERE organization_id = ${organizationId})`;

// Bounds apply before any batch is created, not just to individual rows.
const MAX_IMPORT_BODY_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_ROWS = 500;

const grievanceTypeValues = [
  'individual', 'group', 'policy', 'contract', 'harassment',
  'discrimination', 'safety', 'seniority', 'discipline', 'termination', 'other',
] as const;

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
});

const importRequestSchema = z.object({
  format: z.enum(['json', 'csv']),
  payload: z.union([
    z.string().max(MAX_IMPORT_BODY_BYTES),
    z.array(z.record(z.string(), z.unknown())).max(MAX_IMPORT_ROWS),
  ]),
  sourceSystem: z.string().min(2).max(100).default('unioneyes_manual_import'),
  importSessionId: z.guid().optional(),
  resumeFailedOnly: z.boolean().optional(),
  defaultCreateOfficialCase: z.boolean().optional(),
});

type MappedImportRow = ReturnType<typeof mapImportRowToCanonical>;

function coerceExternalId(row: Record<string, unknown>): string | null {
  const candidate = row.externalId ?? row.external_id ?? row.caseId ?? row.case_id ?? row.reference ?? null;
  const value = candidate ? String(candidate).trim() : '';
  return value.length > 0 ? value : null;
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
  };

  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      out.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  out.push(current.trim());
  return out;
}

function parseCsvPayload(payload: string): Array<Record<string, string>> {
  const lines = payload
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }

  return rows;
}

function mapImportRowToCanonical(row: Record<string, unknown>, defaultCreateOfficialCase: boolean) {
  const typeCandidate = String(row.type ?? row.case_type ?? row.category ?? 'other').toLowerCase();
  const type = grievanceTypeValues.includes(typeCandidate as (typeof grievanceTypeValues)[number])
    ? (typeCandidate as (typeof grievanceTypeValues)[number])
    : 'other';

  return {
    type,
    title: String(row.title ?? row.case_title ?? row.subject ?? '').trim(),
    description: String(row.description ?? row.details ?? row.summary ?? '').trim(),
    priority: row.priority ? String(row.priority).toLowerCase() : undefined,
    grievantName: row.grievantName ? String(row.grievantName) : row.grievant_name ? String(row.grievant_name) : undefined,
    grievantEmail: row.grievantEmail ? String(row.grievantEmail) : row.grievant_email ? String(row.grievant_email) : undefined,
    employerName: row.employerName ? String(row.employerName) : row.employer_name ? String(row.employer_name) : undefined,
    workplaceName: row.workplaceName ? String(row.workplaceName) : row.workplace_name ? String(row.workplace_name) : undefined,
    cbaArticle: row.cbaArticle ? String(row.cbaArticle) : row.cba_article ? String(row.cba_article) : undefined,
    cbaSection: row.cbaSection ? String(row.cbaSection) : row.cba_section ? String(row.cba_section) : undefined,
    incidentDate: row.incidentDate ? String(row.incidentDate) : row.incident_date ? String(row.incident_date) : undefined,
    desiredOutcome: row.desiredOutcome ? String(row.desiredOutcome) : row.desired_outcome ? String(row.desired_outcome) : undefined,
    createOfficialCase: typeof row.createOfficialCase === 'boolean'
      ? row.createOfficialCase
      : typeof row.create_official_case === 'boolean'
        ? row.create_official_case
        : defaultCreateOfficialCase,
  };
}

type RowOutcome =
  | { kind: 'duplicate'; existingGrievanceId: string }
  | { kind: 'invalid'; reason: string }
  | { kind: 'imported'; grievanceId: string; grievanceNumber: string; mode: 'official_case' | 'intake' };

/**
 * One source row, in one organization transaction: its ingestion record, the duplicate check, the case it becomes, the audit of that and the
 * record's final state commit together, so a row is either fully imported (and resumable as such) or not recorded at all.
 */
async function importRow(
  tx: RLSTx,
  input: {
    organizationId: string;
    userId: string;
    batchId: string;
    sourceSystem: string;
    index: number;
    source: Record<string, unknown>;
    defaultCreateOfficialCase: boolean;
  },
): Promise<RowOutcome> {
  const { organizationId, userId, batchId, sourceSystem, index, source } = input;
  const mapped = mapImportRowToCanonical(source, input.defaultCreateOfficialCase);
  const externalId = coerceExternalId(source);
  const fingerprint = computeFingerprint(mapped);

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
    .returning({ id: ingestionRecords.id });

  await trackPilotEvent({
    userId,
    organizationId,
    sessionId: `server:grievance-import`,
    eventType: 'mapping_applied',
    metadata: { rowIndex: index, mode: mapped.createOfficialCase ? 'official_case' : 'intake' },
  }, tx);

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
        or(externalId ? eq(ingestionRecords.externalId, externalId) : undefined, eq(ingestionRecords.fingerprint, fingerprint)),
      ),
    )
    .orderBy(desc(ingestionRecords.createdAt))
    .limit(1);

  if (duplicate?.resolvedId) {
    await tx
      .update(ingestionRecords)
      .set({
        status: 'skipped',
        errorMessage: 'Duplicate row already imported',
        resolvedId: duplicate.resolvedId,
        processedAt: new Date(),
      })
      .where(and(eq(ingestionRecords.id, record.id), recordInOrganization(organizationId)));

    return { kind: 'duplicate', existingGrievanceId: duplicate.resolvedId };
  }

  const validated = importItemSchema.safeParse(mapped);
  if (!validated.success) {
    const reason = validated.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');

    await tx
      .update(ingestionRecords)
      .set({
        status: 'failed',
        errorMessage: reason,
        errorDetails: { issues: validated.error.issues },
        processedAt: new Date(),
      })
      .where(and(eq(ingestionRecords.id, record.id), recordInOrganization(organizationId)));

    await trackPilotEvent({
      userId,
      organizationId,
      sessionId: `server:grievance-import`,
      eventType: 'validation_failed',
      metadata: { rowIndex: index, reason },
    }, tx);

    return { kind: 'invalid', reason };
  }

  const row = validated.data;
  const mode = row.createOfficialCase ? 'official_case' : 'intake';

  const grievanceNumber = `GRV-IMP-${Date.now()}-${randomBytes(3).toString('hex')}`;
  const [g] = await tx.insert(grievances).values({
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
  }).returning();

  await tx.insert(grievanceEvents).values({
    grievanceId: g.id,
    eventType: row.createOfficialCase ? 'created' : 'intake_submitted',
    actorUserId: userId,
    notes: row.createOfficialCase ? 'Case imported via governed ingestion' : 'Intake imported via governed ingestion',
  });

  // Each imported row commits together with its audit record.
  await persistAtomicAudit(tx, {
    organizationId,
    userId,
    action: 'grievance.import_row',
    resourceType: 'grievances',
    resourceId: g.id,
    details: { operation: 'bulk_import', grievanceNumber: g.grievanceNumber, status: g.status, mode },
  });

  await trackPilotEvent({
    userId,
    organizationId,
    sessionId: `server:grievance-import`,
    eventType: 'case_imported',
    metadata: {
      grievanceId: g.id,
      grievanceNumber: g.grievanceNumber,
      mode,
    },
  }, tx);

  if (row.createOfficialCase) {
    await trackPilotEvent({
      userId,
      organizationId,
      sessionId: `server:grievance-import`,
      eventType: 'case_created',
      metadata: { grievanceId: g.id, source: 'governed_import' },
    }, tx);
  }

  await tx
    .update(ingestionRecords)
    .set({
      status: 'succeeded',
      resolvedId: g.id,
      processedAt: new Date(),
    })
    .where(and(eq(ingestionRecords.id, record.id), recordInOrganization(organizationId)));

  return { kind: 'imported', grievanceId: g.id, grievanceNumber: g.grievanceNumber, mode };
}

interface BatchTally {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ rowIndex: number; reason: string }>;
}

/** The session status and its audit commit together. A failed audit leaves the session running. */
async function finalizeBatch(
  organizationId: string,
  userId: string,
  batchId: string,
  sourceSystem: string,
  status: 'completed' | 'partial' | 'failed',
  tally: BatchTally,
  imported: number,
) {
  await withRLSContext({ organizationId }, async (tx) => {
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
      .where(and(eq(ingestionBatches.id, batchId), eq(ingestionBatches.organizationId, organizationId)));

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
    });
  });
}

export const POST = withApi(
  {
    // No role floor: importing many cases is an office-bearer capacity on the canonical membership (hasCaseFilingCapacity below).
    auth: { required: true },
    entitlement: 'grievance_case_suite',
    // The import commits row by row, so a row that fails or a request that dies keeps what was imported and a session can be resumed. One transaction around
    // 500 rows would lose all of it, and the wrapper would hold one for the whole handler (always in the canonical state, for a route that requires an
    // organization), so this route opens a transaction per unit of work and checks the organization itself.
    requireOrg: false,
    // The import body is bounded by the framework's reader as well as by this route's own read below: one limit, one constant.
    bodyLimitBytes: MAX_IMPORT_BODY_BYTES,
    registry: { audience: 'officer', orgScoping: 'caller-org' },
    openapi: { tags: ['Grievances'], summary: 'Import grievances from CSV or JSON' },
  },
  async ({ request, organizationId, userId }) => {
    if (!organizationId || !userId) {
      throw ApiError.forbidden('Organization context required — select an organization before accessing this resource');
    }

    // Importing many cases is an office-bearer capacity on the canonical membership, not a role rank.
    const canImport = await hasCaseFilingCapacity({ userId, organizationId }, 'bulk');
    if (!canImport) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Importing cases requires an officer or executive capacity');
    }

    let rawBody: unknown;
    try {
      rawBody = await readBoundedJson(request, MAX_IMPORT_BODY_BYTES);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return NextResponse.json({
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Import request exceeds the 2 MiB limit. Split it into smaller batches.',
        }, { status: 413, headers: { 'Cache-Control': 'private, no-store' } });
      }
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid JSON request body');
    }

    const parsed = importRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid import request', parsed.error.flatten());
    }

    const sourceSystem = parsed.data.sourceSystem;
    const defaultCreateOfficialCase = parsed.data.defaultCreateOfficialCase ?? false;

    const sourceRows: Array<Record<string, unknown>> = parsed.data.format === 'json'
      ? (Array.isArray(parsed.data.payload) ? parsed.data.payload : [])
      : parseCsvPayload(String(parsed.data.payload));

    if (sourceRows.length === 0) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'No rows found in import payload');
    }
    if (sourceRows.length > MAX_IMPORT_ROWS) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Import exceeds 500 rows. Split it into smaller batches.');
    }

    // The session: a resumed one must belong to this organization; a new one is created and committed before any row is read.
    const requestedSession = parsed.data.importSessionId;
    const session = await withRLSContext({ organizationId }, async (tx) => {
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
          .limit(1);
        if (!existingBatch) return null;
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
                totalRecords: sourceRows.length,
                processed: 0,
                succeeded: 0,
                failed: 0,
                skipped: 0,
                startedAt: new Date(),
                createdBy: userId,
                metadata: {
                  format: parsed.data.format,
                  resumeFailedOnly: parsed.data.resumeFailedOnly ?? false,
                },
              })
              .returning({ id: ingestionBatches.id })
          )[0].id;

      const processedIndexes = parsed.data.resumeFailedOnly
        ? new Set(
            (
              await tx
                .select({ recordIndex: ingestionRecords.recordIndex })
                .from(ingestionRecords)
                .where(
                  and(
                    eq(ingestionRecords.batchId, batchId),
                    eq(ingestionRecords.status, 'succeeded'),
                  ),
                )
            ).map((r) => r.recordIndex),
          )
        : new Set<number>();

      return { batchId, processedIndexes };
    });

    if (!session) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, 'Import session not found for this organization');
    }
    const { batchId, processedIndexes } = session;

    const imported: Array<{ grievanceId: string; grievanceNumber: string; mode: 'official_case' | 'intake' }> = [];
    const skipped: Array<{ rowIndex: number; reason: string; existingGrievanceId?: string }> = [];
    const failed: Array<{ rowIndex: number; reason: string }> = [];

    const tally: BatchTally = { total: sourceRows.length, processed: 0, succeeded: 0, failed: 0, skipped: 0, errors: failed };

    try {
      for (let i = 0; i < sourceRows.length; i++) {
        if (processedIndexes.has(i)) {
          skipped.push({ rowIndex: i, reason: 'Already processed successfully in this import session' });
          tally.skipped++;
          continue;
        }

        const outcome = await withRLSContext({ organizationId }, (tx) =>
          importRow(tx, {
            organizationId,
            userId,
            batchId,
            sourceSystem,
            index: i,
            source: sourceRows[i],
            defaultCreateOfficialCase,
          }),
        );

        tally.processed++;
        if (outcome.kind === 'duplicate') {
          skipped.push({ rowIndex: i, reason: 'Duplicate row already imported', existingGrievanceId: outcome.existingGrievanceId });
          tally.skipped++;
        } else if (outcome.kind === 'invalid') {
          failed.push({ rowIndex: i, reason: outcome.reason });
          tally.failed++;
        } else {
          imported.push({ grievanceId: outcome.grievanceId, grievanceNumber: outcome.grievanceNumber, mode: outcome.mode });
          tally.succeeded++;
        }
      }
    } catch (error) {
      // What was imported stays imported (each row committed on its own). The session is closed as failed so it does not stay "running", and the
      // fault is not hidden: the request fails and the session can be resumed with resumeFailedOnly.
      logger.error('Grievance import stopped on an unexpected fault', { importSessionId: batchId, rowsProcessed: tally.processed, error: String(error) });
      await finalizeBatch(organizationId, userId, batchId, sourceSystem, 'failed', tally, imported.length).catch((finalizeError) =>
        logger.error('Grievance import session could not be closed after a fault', { importSessionId: batchId, error: String(finalizeError) }),
      );
      throw error;
    }

    // ingestion_batches.status is varchar(20): the longer "completed_with_errors" could never be stored, so a run with a failed row failed at its close.
    const batchStatus = tally.failed > 0 && tally.succeeded === 0
      ? 'failed'
      : tally.failed > 0
        ? 'partial'
        : 'completed';

    await finalizeBatch(organizationId, userId, batchId, sourceSystem, batchStatus, tally, imported.length);

    return standardSuccessResponse({
      importSessionId: batchId,
      sourceSystem,
      status: batchStatus,
      totalRows: sourceRows.length,
      importedRows: imported.length,
      skippedRows: skipped.length,
      failedRows: failed.length,
      imported,
      skipped,
      failed,
    });
  },
);

export const GET = withApi(
  {
    // No role floor: viewing import sessions is an office-bearer capacity on the canonical membership (hasCaseFilingCapacity below).
    auth: { required: true },
    entitlement: 'grievance_case_suite',
    // Every read below goes through the ambient handle, so the handler runs in the caller's organization transaction.
    rlsOrgContext: true,
    openapi: { tags: ['Grievances'], summary: 'List import sessions or read one with its records' },
  },
  async ({ request, organizationId, userId }) => {
    if (!organizationId || !userId) {
      throw ApiError.forbidden('Organization context required — select an organization before accessing this resource');
    }

    const canImport = await hasCaseFilingCapacity({ userId, organizationId }, 'bulk');
    if (!canImport) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Viewing import sessions requires an officer or executive capacity');
    }

    const sessionId = new URL(request.url).searchParams.get('importSessionId');
    if (!sessionId) {
      const recent = await db
        .select()
        .from(ingestionBatches)
        .where(eq(ingestionBatches.organizationId, organizationId))
        .orderBy(sql`${ingestionBatches.createdAt} DESC`)
        .limit(25);

      return standardSuccessResponse({ sessions: recent });
    }
    if (!zUUID.safeParse(sessionId).success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'importSessionId must be a valid session identifier');
    }

    const [batch] = await db
      .select()
      .from(ingestionBatches)
      .where(
        and(
          eq(ingestionBatches.id, sessionId),
          eq(ingestionBatches.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!batch) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, 'Import session not found');
    }

    const records = await db
      .select()
      .from(ingestionRecords)
      .where(and(eq(ingestionRecords.batchId, sessionId), recordInOrganization(organizationId)))
      .orderBy(sql`${ingestionRecords.recordIndex} ASC`);

    return standardSuccessResponse({
      session: batch,
      records,
    });
  },
);
