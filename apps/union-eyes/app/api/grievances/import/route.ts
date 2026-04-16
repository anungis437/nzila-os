import { z } from 'zod';
import { db } from '@/db/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { grievanceEvents } from '@/db/schema/domains/claims/grievance-lifecycle';
import { ingestionBatches, ingestionRecords } from '@/db/schema/ingestion-schema';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { hasMinRole } from '@/lib/api-auth-guard';
import { auditDataMutation, auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { trackPilotEvent } from '@/lib/services/pilot-tracking';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';
import { randomBytes, createHash } from 'crypto';
import { and, eq, sql } from 'drizzle-orm';

const grievanceTypeValues = [
  'individual', 'group', 'policy', 'contract', 'harassment',
  'discrimination', 'safety', 'seniority', 'discipline', 'termination', 'other',
] as const;

const importItemSchema = z.object({
  type: z.enum(grievanceTypeValues).default('other'),
  title: z.string().min(5).max(500),
  description: z.string().min(10),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  grievantName: z.string().max(255).optional(),
  grievantEmail: z.string().email().max(255).optional(),
  employerName: z.string().max(255).optional(),
  workplaceName: z.string().max(255).optional(),
  cbaArticle: z.string().max(100).optional(),
  cbaSection: z.string().max(100).optional(),
  incidentDate: z.string().datetime({ offset: true }).optional().or(z.string().date().optional()),
  desiredOutcome: z.string().optional(),
  createOfficialCase: z.boolean().optional(),
});

const importRequestSchema = z.object({
  format: z.enum(['json', 'csv']),
  payload: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]),
  sourceSystem: z.string().min(2).max(100).default('unioneyes_manual_import'),
  importSessionId: z.string().uuid().optional(),
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

export const POST = withOrganizationAuth(async (request, context) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  const canImport = await hasMinRole('steward');
  if (!canImport) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Only steward or above can import cases');
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
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

  let batchId = parsed.data.importSessionId;

  if (batchId) {
    const [existingBatch] = await db
      .select()
      .from(ingestionBatches)
      .where(
        and(
          eq(ingestionBatches.id, batchId),
          eq(ingestionBatches.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!existingBatch) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, 'Import session not found for this organization');
    }
  } else {
    const [createdBatch] = await db
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
      .returning({ id: ingestionBatches.id });

    batchId = createdBatch.id;
  }

  const imported: Array<{ grievanceId: string; grievanceNumber: string; mode: 'official_case' | 'intake' }> = [];
  const skipped: Array<{ rowIndex: number; reason: string; existingGrievanceId?: string }> = [];
  const failed: Array<{ rowIndex: number; reason: string }> = [];

  if (!batchId) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Unable to initialize import session');
  }

  const processedIndexes = parsed.data.resumeFailedOnly
    ? new Set(
        (
          await db
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

  let processedCount = 0;
  let succeededCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < sourceRows.length; i++) {
    if (processedIndexes.has(i)) {
      skipped.push({ rowIndex: i, reason: 'Already processed successfully in this import session' });
      skippedCount++;
      continue;
    }

    const mapped = mapImportRowToCanonical(sourceRows[i], defaultCreateOfficialCase);
    const externalId = coerceExternalId(sourceRows[i]);
    const fingerprint = computeFingerprint(mapped);

    const [record] = await db
      .insert(ingestionRecords)
      .values({
        batchId,
        recordIndex: i,
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
      metadata: { rowIndex: i, mode: mapped.createOfficialCase ? 'official_case' : 'intake' },
    });

    const [duplicate] = await db.execute(sql`
      SELECT ir.resolved_id
      FROM ingestion_records ir
      INNER JOIN ingestion_batches ib ON ib.id = ir.batch_id
      WHERE ib.organization_id = ${organizationId}::uuid
        AND ib.source_system = ${sourceSystem}
        AND ir.record_type = 'grievance'
        AND ir.id <> ${record.id}::uuid
        AND ir.status = 'succeeded'
        AND (
          (${externalId}::text IS NOT NULL AND ir.external_id = ${externalId})
          OR ir.fingerprint = ${fingerprint}
        )
      ORDER BY ir.created_at DESC
      LIMIT 1
    `) as Array<{ resolved_id: string | null }>;

    if (duplicate?.resolved_id) {
      skipped.push({ rowIndex: i, reason: 'Duplicate row already imported', existingGrievanceId: duplicate.resolved_id });
      skippedCount++;
      processedCount++;

      await db
        .update(ingestionRecords)
        .set({
          status: 'skipped',
          errorMessage: 'Duplicate row already imported',
          resolvedId: duplicate.resolved_id,
          processedAt: new Date(),
        })
        .where(eq(ingestionRecords.id, record.id));

      continue;
    }

    const validated = importItemSchema.safeParse(mapped);
    if (!validated.success) {
      const reason = validated.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
      failed.push({ rowIndex: i, reason });
      failedCount++;
      processedCount++;

      await db
        .update(ingestionRecords)
        .set({
          status: 'failed',
          errorMessage: reason,
          errorDetails: { issues: validated.error.issues },
          processedAt: new Date(),
        })
        .where(eq(ingestionRecords.id, record.id));

      await trackPilotEvent({
        userId,
        organizationId,
        sessionId: `server:grievance-import`,
        eventType: 'validation_failed',
        metadata: { rowIndex: i, reason },
      });

      continue;
    }

    const row = validated.data;
    const mode = row.createOfficialCase ? 'official_case' : 'intake';

    const [created] = await withRLSContext(async () => {
      const grievanceNumber = `GRV-IMP-${Date.now()}-${randomBytes(3).toString('hex')}`;
      const [g] = await db.insert(grievances).values({
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

      await db.insert(grievanceEvents).values({
        grievanceId: g.id,
        eventType: row.createOfficialCase ? 'created' : 'intake_submitted',
        actorUserId: userId,
        notes: row.createOfficialCase ? 'Case imported via governed ingestion' : 'Intake imported via governed ingestion',
      });

      return [g];
    });

    await auditDataMutation({
      userId,
      organizationId,
      resource: 'grievances',
      action: 'create',
      resourceId: created.id,
      details: { operation: 'bulk_import' },
      newState: {
        grievanceNumber: created.grievanceNumber,
        status: created.status,
        mode,
      },
    });

    await trackPilotEvent({
      userId,
      organizationId,
      sessionId: `server:grievance-import`,
      eventType: 'case_imported',
      metadata: {
        grievanceId: created.id,
        grievanceNumber: created.grievanceNumber,
        mode,
      },
    });

    if (row.createOfficialCase) {
      await trackPilotEvent({
        userId,
        organizationId,
        sessionId: `server:grievance-import`,
        eventType: 'case_created',
        metadata: { grievanceId: created.id, source: 'governed_import' },
      });
    }

    imported.push({
      grievanceId: created.id,
      grievanceNumber: created.grievanceNumber,
      mode,
    });

    await db
      .update(ingestionRecords)
      .set({
        status: 'succeeded',
        resolvedId: created.id,
        processedAt: new Date(),
      })
      .where(eq(ingestionRecords.id, record.id));

    processedCount++;
    succeededCount++;
  }

  const batchStatus = failedCount > 0 && succeededCount === 0
    ? 'failed'
    : failedCount > 0
      ? 'completed_with_errors'
      : 'completed';

  await db
    .update(ingestionBatches)
    .set({
      status: batchStatus,
      totalRecords: sourceRows.length,
      processed: processedCount,
      succeeded: succeededCount,
      failed: failedCount,
      skipped: skippedCount,
      completedAt: new Date(),
      errorSummary: failed.map((f) => ({ rowIndex: f.rowIndex, reason: f.reason })),
    })
    .where(eq(ingestionBatches.id, batchId));

  await auditLog({
    eventType: AuditEventType.DATA_CREATE,
    severity: failed.length ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
    userId,
    organizationId,
    resource: 'grievances',
    action: 'bulk_import',
    details: {
      importSessionId: batchId,
      sourceSystem,
      totalRows: sourceRows.length,
      importedRows: imported.length,
      skippedRows: skipped.length,
      failedRows: failed.length,
    },
  });

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
});

export const GET = withOrganizationAuth(async (request, context) => {
  const { organizationId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  const canImport = await hasMinRole('steward');
  if (!canImport) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Only steward or above can view import sessions');
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
    .where(eq(ingestionRecords.batchId, sessionId))
    .orderBy(sql`${ingestionRecords.recordIndex} ASC`);

  return standardSuccessResponse({
    session: batch,
    records,
  });
});
