/**
 * Remittance File Upload
 *
 * POST /api/dues/remittances/upload
 *
 * Accepts a multipart/form-data payload with:
 *   - file: the employer remittance file (CSV/XLSX/PDF)
 *   - metadata: JSON string with { employerId, periodStart, periodEnd, fiscalYear, fiscalMonth }
 *
 * The original bytes are hashed (SHA-256) and preserved in authorized blob
 * storage BEFORE any record is created. If preservation fails, no remittance
 * record is created and the request fails. A duplicate file (same hash within the
 * organization) is rejected.
 *
 * The resulting record is SOURCE_PRESERVED_UNPARSED: the file has not been
 * parsed, members have not been matched, and the zero totals are placeholders,
 * not reconciled amounts. No parser/matcher is invoked here.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { and, eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { employerRemittances } from '@/db/schema/dues-finance-schema';
import { logger } from '@/lib/logger';
import { buildUnionEvidencePack } from '@/lib/evidence';
import { putBlob, deleteBlob } from '@/lib/blob-client';
import { FINANCIAL_MEMBER_DATA_ROLES } from '@/lib/finance/financial-authority';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';

export const dynamic = 'force-dynamic';

const MAX_REMITTANCE_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_REMITTANCE_EXTENSIONS = new Set(['csv', 'xlsx', 'pdf']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'Upload employer remittance file' },
  },
  async ({ request, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const metadataRaw = formData.get('metadata') as string | null;

    if (!file) throw ApiError.badRequest('No file provided');

    let meta: {
      employerId?: string;
      periodStart?: string;
      periodEnd?: string;
      fiscalYear?: number;
      fiscalMonth?: number;
    } = {};

    if (metadataRaw) {
      try {
        meta = JSON.parse(metadataRaw);
      } catch {
        throw ApiError.badRequest('Invalid metadata JSON');
      }
    }

    if (!meta.employerId) throw ApiError.badRequest('employerId is required in metadata');
    if (!UUID_PATTERN.test(meta.employerId)) throw ApiError.badRequest('employerId must be a valid UUID');
    if (!meta.periodStart || !meta.periodEnd) {
      throw ApiError.badRequest('periodStart and periodEnd are required in metadata');
    }

    const periodStart = new Date(meta.periodStart);
    const periodEnd = new Date(meta.periodEnd);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodEnd < periodStart) {
      throw ApiError.badRequest('periodStart/periodEnd must be valid dates with periodEnd on or after periodStart');
    }

    const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
    if (!ALLOWED_REMITTANCE_EXTENSIONS.has(extension)) {
      throw ApiError.badRequest('Remittance file must be a CSV, XLSX or PDF file');
    }
    if (file.size === 0) throw ApiError.badRequest('Remittance file is empty');
    if (file.size > MAX_REMITTANCE_FILE_BYTES) throw ApiError.badRequest('Remittance file exceeds the 10 MB limit');

    await withRLSContext({ organizationId, userId }, (tx) =>
      requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:prepare', employerId: meta.employerId }),
    );

    const bytes = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash('sha256').update(bytes).digest('hex');

    const [duplicate] = await db
      .select({ id: employerRemittances.id })
      .from(employerRemittances)
      .where(and(eq(employerRemittances.organizationId, organizationId), eq(employerRemittances.fileHash, fileHash)))
      .limit(1);
    if (duplicate) {
      throw ApiError.conflict('This remittance file has already been uploaded', { remittanceId: duplicate.id });
    }

    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
    let storedPath: string;
    try {
      const stored = await putBlob(`remittances/${organizationId}/${fileHash}-${safeName}`, bytes, {
        contentType: file.type || 'application/octet-stream',
      });
      storedPath = stored.pathname;
    } catch (error) {
      logger.error('Remittance source preservation failed', {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw ApiError.externalService('document-storage', 'Remittance file could not be preserved; nothing was recorded');
    }

    let remittance;
    try {
      // The record and its audit commit together; if either fails the preserved blob is removed again.
      remittance = await withRLSContext({ organizationId, userId }, async (tx) => {
        await requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:prepare', employerId: meta.employerId });
        const [row] = await tx
          .insert(employerRemittances)
          .values({
            employerId: meta.employerId!,
            organizationId,
            periodStart,
            periodEnd,
            fiscalYear: meta.fiscalYear ?? periodStart.getFullYear(),
            fiscalMonth: meta.fiscalMonth ?? periodStart.getMonth() + 1,
            remittanceDate: new Date(),
            fileName: file.name,
            fileUrl: storedPath,
            fileHash,
            processingStatus: 'pending',
            memberCount: 0,
            totalAmount: '0',
            createdBy: userId,
          })
          .returning();
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'dues.remittance.upload',
          resourceType: 'employer_remittances',
          resourceId: row.id,
          details: { fileName: file.name, fileHash, employerId: meta.employerId },
        });
        return row;
      });
    } catch (error) {
      await deleteBlob(storedPath).catch(() => undefined);
      throw error;
    }

    logger.info('Remittance file preserved', {
      remittanceId: remittance.id,
      fileName: file.name,
      fileHash,
      organizationId,
    });

    buildUnionEvidencePack({
      actionType: 'REMITTANCE_FILE_UPLOADED',
      orgId: organizationId!,
      actorId: userId!,
      artifacts: [{ type: 'remittance', data: { remittanceId: remittance.id, fileName: file.name, fileHash } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'REMITTANCE_FILE_UPLOADED' }));

    return {
      remittance,
      ingestion: {
        state: 'SOURCE_PRESERVED_UNPARSED',
        parsed: false,
        matched: false,
        reconciled: false,
        totalsArePlaceholders: true,
      },
    };
  },
);
