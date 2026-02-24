/**
 * Document OCR Processing API Route
 * POST /api/documents/[id]/ocr - Process document with OCR
 */

import { NextRequest, NextResponse } from "next/server";
import { logApiAuditEvent } from "@/lib/middleware/api-security";
import { processDocumentOCR } from "@/lib/services/document-service";
import { withRoleAuth } from '@/lib/api-auth-guard';

 
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
/**
 * POST /api/documents/[id]/ocr
 * Process document with OCR to extract text content
 */
export const POST = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  return withRoleAuth('steward', async (request, context) => {
    const { userId, organizationId: _organizationId } = context as { userId: string; organizationId: string };

  try {
        const result = await processDocumentOCR(params.id);
        
        logApiAuditEvent({
          timestamp: new Date().toISOString(), userId,
          endpoint: `/api/documents/${params.id}/ocr`,
          method: 'POST',
          eventType: 'success',
          severity: 'medium',
          details: { documentId: params.id },
        });

        return NextResponse.json(result);
      } catch (error) {
        logApiAuditEvent({
          timestamp: new Date().toISOString(), userId,
          endpoint: `/api/documents/${params.id}/ocr`,
          method: 'POST',
          eventType: 'validation_failed',
          severity: 'high',
          details: { documentId: params.id, error: error instanceof Error ? error.message : 'Unknown error' },
        });
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to process document OCR',
      error
    );
      }
      })(request, { params });
};
