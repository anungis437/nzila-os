import {
  importGrievanceRow, openGrievanceImportSession, finalizeGrievanceImportBatch,
  listGrievanceImportSessions, readGrievanceImportSession, type BatchTally,
} from '@/lib/services/grievance-import-service';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { readBoundedJson, RequestBodyTooLargeError } from '@/lib/api/bounded-json';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { hasCaseFilingCapacity } from '@/lib/cases/case-authorization';
import { logger } from '@/lib/logger';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';

// Bounds apply before any batch is created, not just to individual rows.
const MAX_IMPORT_BODY_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_ROWS = 500;

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

async function finalizeBatch(
  organizationId: string, userId: string, batchId: string, sourceSystem: string,
  status: 'completed' | 'partial' | 'failed', tally: BatchTally, imported: number,
) {
  return withRLSContext({ organizationId }, tx =>
    finalizeGrievanceImportBatch(tx, organizationId, userId, batchId, sourceSystem, status, tally, imported),
  );
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
    const session = await withRLSContext({ organizationId }, (tx) =>
      openGrievanceImportSession(tx, {
        organizationId, userId, requestedSession, sourceSystem, totalRows: sourceRows.length,
        format: parsed.data.format, resumeFailedOnly: parsed.data.resumeFailedOnly ?? false,
      }),
    );

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
          importGrievanceRow(tx, {
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
    // The service reads on this caller organization transaction; canonical nested reads reuse it.
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
      const recent = await withRLSContext({ organizationId }, tx => listGrievanceImportSessions(tx, organizationId));

      return standardSuccessResponse({ sessions: recent });
    }
    if (!zUUID.safeParse(sessionId).success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'importSessionId must be a valid session identifier');
    }

    const result = await withRLSContext({ organizationId }, tx => readGrievanceImportSession(tx, organizationId, sessionId));
    if (!result) return standardErrorResponse(ErrorCode.NOT_FOUND, 'Import session not found');
    return standardSuccessResponse(result);
  },
);
