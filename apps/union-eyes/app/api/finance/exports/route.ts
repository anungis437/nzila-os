/**
 * GET /api/finance/exports — Generate Nzila platform-billing exports
 *
 * Domain: NZILA_PLATFORM_BILLING. These are the SaaS subscription billing
 * records for the calling organization (invoices, chargebacks, platform GL
 * journal). They are NOT the union's general ledger, bank, dues or remittance
 * records and must not be presented as such.
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
import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
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

// An id that is not a uuid is a client error here, never a database fault handed back as a 500.
const querySchema = z.object({
  type: z.string().optional(),
  periodId: z.guid().optional(),
  invoiceId: z.guid().optional(),
  allocationRunId: z.guid().optional(),
  localId: z.guid().optional(),
  format: z.string().optional(),
});

// The exports read the caller organization's own billing records: they run in that organization's tenant transaction.
export const GET = withApi(
  {
    auth: { minRole: 'secretary_treasurer' },
    entitlement: 'financial_intelligence_suite',
    rlsOrgContext: true,
    query: querySchema,
    registry: { audience: 'officer', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Finance'], summary: 'Generate Nzila platform-billing exports' },
  },
  async ({ organizationId, query }) => {
    const orgId = organizationId!;
    const { type, periodId, format = 'json' } = query;

    if (!type) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Export type required');
    }

    try {
      switch (type) {
        case 'master_invoice': {
          if (!query.invoiceId) {
            return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'invoiceId required');
          }
          const data = await exportMasterInvoice(orgId, query.invoiceId);
          return standardSuccessResponse(data);
        }

        case 'allocation_statement': {
          if (!query.allocationRunId) {
            return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'allocationRunId required');
          }
          const data = await exportAllocationStatement(orgId, query.allocationRunId);
          return standardSuccessResponse(data);
        }

        case 'chargeback_report': {
          if (!query.localId) {
            return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'localId required');
          }
          const data = await exportChargebackReport(orgId, query.localId, periodId);
          return standardSuccessResponse(data);
        }

        case 'gl_journal': {
          if (!periodId) {
            return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'periodId required');
          }
          const journal = await exportGlJournal(orgId, periodId);

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
          const data = await generateEvidencePack(orgId, periodId);
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
  },
);
