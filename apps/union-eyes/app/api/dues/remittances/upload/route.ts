/**
 * Remittance File Upload
 *
 * POST /api/dues/remittances/upload
 *
 * Accepts a multipart/form-data payload with:
 *   - file: the employer remittance file (CSV/XLSX/PDF)
 *   - metadata: JSON string with { employerId, periodStart, periodEnd, fiscalYear, fiscalMonth }
 *
 * Creates an employerRemittances record in 'pending' status and returns it.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { employerRemittances } from '@/db/schema/dues-finance-schema';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'Upload employer remittance file' },
  },
  async ({ request, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

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
    if (!meta.periodStart || !meta.periodEnd) {
      throw ApiError.badRequest('periodStart and periodEnd are required in metadata');
    }

    const [remittance] = await db
      .insert(employerRemittances)
      .values({
        employerId: meta.employerId,
        organizationId,
        periodStart: new Date(meta.periodStart),
        periodEnd: new Date(meta.periodEnd),
        fiscalYear: meta.fiscalYear ?? new Date().getFullYear(),
        fiscalMonth: meta.fiscalMonth ?? new Date().getMonth() + 1,
        remittanceDate: new Date(),
        fileName: file.name,
        processingStatus: 'pending',
        createdBy: userId ?? undefined,
      })
      .returning();

    logger.info('Remittance file uploaded', {
      remittanceId: remittance.id,
      fileName: file.name,
      organizationId,
    });

    return { remittance };
  },
);
