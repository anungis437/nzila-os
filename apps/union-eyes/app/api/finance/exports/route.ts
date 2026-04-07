/**
 * GET /api/finance/exports — Generate finance exports
 *
 * Query params:
 *   type: master_invoice | allocation_statement | chargeback_report | gl_journal | evidence_pack
 *   periodId: UUID of billing period
 *   invoiceId: UUID (for master_invoice)
 *   allocationRunId: UUID (for allocation_statement)
 *   localId: UUID (for chargeback_report)
 *   format: json | csv (for gl_journal only, default json)
 */

import { NextResponse } from 'next/server';
import { withMinRole, type BaseAuthContext } from '@/lib/api-auth-guard';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import {
  exportMasterInvoice,
  exportAllocationStatement,
  exportChargebackReport,
  exportGlJournal,
  glJournalToCsv,
  generateEvidencePack,
} from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

export const GET = withMinRole('officer', async (request, context: BaseAuthContext) => {
  const { organizationId, userId } = context;
  if (!organizationId) {
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
  }
  try {
    await requireEntitlement(organizationId, 'financial_intelligence_suite', userId);
  } catch (err) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, err instanceof Error ? err.message : 'Entitlement required');
  }

  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const periodId = url.searchParams.get('periodId');
  const format = url.searchParams.get('format') ?? 'json';

  if (!type) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Export type required');
  }

  try {
    switch (type) {
      case 'master_invoice': {
        const invoiceId = url.searchParams.get('invoiceId');
        if (!invoiceId) {
          return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'invoiceId required');
        }
        const data = await exportMasterInvoice(organizationId, invoiceId);
        return standardSuccessResponse(data);
      }

      case 'allocation_statement': {
        const allocationRunId = url.searchParams.get('allocationRunId');
        if (!allocationRunId) {
          return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'allocationRunId required');
        }
        const data = await exportAllocationStatement(organizationId, allocationRunId);
        return standardSuccessResponse(data);
      }

      case 'chargeback_report': {
        const localId = url.searchParams.get('localId');
        if (!localId) {
          return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'localId required');
        }
        const data = await exportChargebackReport(organizationId, localId, periodId ?? undefined);
        return standardSuccessResponse(data);
      }

      case 'gl_journal': {
        if (!periodId) {
          return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'periodId required');
        }
        const journal = await exportGlJournal(organizationId, periodId);

        if (format === 'csv') {
          const csv = glJournalToCsv(journal);
          return new NextResponse(csv, {
            status: 200,
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="gl-journal-${periodId}.csv"`,
            },
          });
        }
        return standardSuccessResponse(journal);
      }

      case 'evidence_pack': {
        if (!periodId) {
          return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'periodId required');
        }
        const data = await generateEvidencePack(organizationId, periodId);
        return standardSuccessResponse(data);
      }

      default:
        return standardErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          `Unknown export type: ${type}. Valid: master_invoice, allocation_statement, chargeback_report, gl_journal, evidence_pack`,
        );
    }
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Export failed', error);
  }
});
