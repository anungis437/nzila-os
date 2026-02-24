import { NextResponse } from 'next/server';
/**
 * GET /api/signatures/audit/[documentId]
 * Migrated to withApi() framework
 */
import { AuditTrailService } from "@/lib/signature/signature-service";

 
 
 
 
import { withApi, ApiError } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Signatures'],
      summary: 'GET [documentId]',
    },
  },
  async ({ request, params, userId: _userId, organizationId: _organizationId, user, body: _body, query: _query }) => {

        if (!user) {
          throw ApiError.unauthorized('Unauthorized'
        );
        }
        const documentId = params.documentId;
        // Get query params
        const { searchParams } = new URL(request.url);
        const format = searchParams.get("format"); // 'json' or 'report'
        if (format === "report") {
          // Generate comprehensive audit report
          const report = await AuditTrailService.generateAuditReport(documentId);
          return NextResponse.json({
            report,
            message: "Audit report generated successfully",
          });
        } else {
          // Return raw audit trail
          const auditTrail = await AuditTrailService.getDocumentAudit(documentId);
          return NextResponse.json({
            documentId,
            events: auditTrail,
            totalEvents: auditTrail.length,
          });
        }
  },
);
