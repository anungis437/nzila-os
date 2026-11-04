/**
 * GDPR Data Export API (Article 15)
 * POST /api/gdpr/data-export - Request data export
 * GET /api/gdpr/data-export - Download exported data
 */

import { z } from 'zod';
import { NextResponse } from "next/server";
import { withApi } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { GdprRequestManager } from "@/lib/gdpr/consent-manager";
import { getReportQueue } from "@/lib/job-queue";
import { logger } from "@/lib/logger";
import fs from "fs";
import path from "path";

import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';

async function rejectExportRequest(requestId: string, organizationId: string, userId: string, reason: string) {
  await withRLSContext({ organizationId }, async (tx) => {
    await GdprRequestManager.updateRequestStatus(requestId, organizationId, 'rejected', { rejectionReason: reason }, tx);
    await persistAtomicAudit(tx, {
      organizationId,
      userId,
      action: 'gdpr.data_export.reject',
      resourceType: 'gdpr_data_requests',
      resourceId: requestId,
      details: { reason },
    });
  });
}
/**
 * Request data export
 */

const gdprDataExportSchema = z.object({
  organizationId: z.guid('Invalid organizationId'),
  preferredFormat: z.string().optional(),
  requestDetails: z.record(z.string(), z.unknown()).optional(),
});

// The export is queued on Redis and the notification is sent by e-mail (network calls), so no transaction spans the handler: the request, its
// status and its audit record commit together in the organization's tenant transaction, and the notification runs in one of its own.
export const POST = withApi(
  {
    auth: { required: true },
    openapi: { tags: ['GDPR'], summary: 'Request an export of the caller\'s personal data (Article 15)' },
  },
  async ({ request, userId: actor, organizationId: activeOrganizationId }) => {
  try {
    const userId = actor!;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'A JSON body is required');
    }
    // Validate request body
    const validation = gdprDataExportSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.issues
      );
    }
    
    const { organizationId, preferredFormat, requestDetails } = validation.data;
    const format = preferredFormat || "json";

    // A subject-access request may only be filed for the caller's own selected organization.
    if (organizationId !== activeOrganizationId) {
      return NextResponse.json({ error: 'Forbidden: organization does not match the active organization' }, { status: 403 });
    }

    if (!organizationId) {
      return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Organization ID required'
    );
    }

    if (!['json', 'csv', 'xml'].includes(format as string)) {
      return NextResponse.json(
        { error: "Unsupported export format" },
        { status: 400 }
      );
    }

    // The request, its status and the audit record commit together; the queue below is the only effect outside.
    const gdprRequest = await withRLSContext({ organizationId }, async (tx) => {
      const created = await GdprRequestManager.createDataAccessRequest(
        {
          userId: userId,
          organizationId,
          requestDetails: {
            preferredFormat: format,
            ...(requestDetails ?? {}),
          },
          verificationMethod: "email",
        },
        tx,
      );
      await GdprRequestManager.updateRequestStatus(created.id, organizationId, "in_progress", { processedBy: "system" }, tx);
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'gdpr.data_export.request',
        resourceType: 'gdpr_data_requests',
        resourceId: created.id,
        details: { format },
      });
      return created;
    });
    await withRLSContext({ organizationId }, () => GdprRequestManager.notifyDataAccessRequest(gdprRequest));

    const queue = getReportQueue();
    if (!queue) {
      await rejectExportRequest(gdprRequest.id, organizationId, userId, 'Export service unavailable');
      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Export service temporarily unavailable. Please try again later.',
      );
    }

    try {
      await (queue as any as { add: (...args: any[]) => Promise<any> }).add(
        "gdpr-export",
        {
          reportType: "gdpr_export",
          organizationId,
          userId,
          parameters: {
            requestId: gdprRequest.id,
            format,
          },
        },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 2000 },
        }
      );
    } catch (error) {
      logger.error('GDPR export could not be queued', { requestId: gdprRequest.id, error });
      await rejectExportRequest(gdprRequest.id, organizationId, userId, 'Export could not be queued');
      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Export service temporarily unavailable. Please try again later.',
      );
    }

    return NextResponse.json({
      success: true,
      requestId: gdprRequest.id,
      status: "processing",
      message: "Your data export request has been received and is being processed",
      estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  } catch (error) {
    logger.error('Failed to process the data export request', { error });
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to process data export request',
      error
    );
  }
  },
);

/**
 * Download exported data
 */
// The request is read in the caller's own organization (the one the wrapper resolved); a client-supplied organization may only repeat it.
export const GET = withApi(
  {
    auth: { required: true },
    openapi: { tags: ['GDPR'], summary: 'Download a completed personal data export' },
  },
  async ({ request, userId: actor, organizationId: activeOrganizationId }) => {
  try {
    const userId = actor!;
    const organizationId = activeOrganizationId!;
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("requestId");
    const organizationIdFromQuery = searchParams.get("organizationId") ?? searchParams.get("orgId") ?? searchParams.get("organization_id") ?? searchParams.get("org_id");

    if (!requestId) {
      return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Request ID required'
    );
    }
    if (organizationIdFromQuery && organizationIdFromQuery !== organizationId) {
      return NextResponse.json({ error: 'Forbidden: organization does not match the active organization' }, { status: 403 });
    }

    // Get request status
    const requests = await withRLSContext({ organizationId }, () => GdprRequestManager.getUserRequests(userId, organizationId));
    const gdprRequest = requests.find((r) => r.id === requestId);

    if (!gdprRequest) {
      return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Request not found'
    );
    }

    if (gdprRequest.status !== "completed") {
      return standardSuccessResponse(
      { 
          status: gdprRequest.status,
          message: "Export is still being processed",
         }
    );
    }

    const responseData = gdprRequest.responseData as Record<string, unknown>;
    const fileName = responseData?.fileName as string | undefined;
    const expiresAt = responseData?.expiresAt ? new Date(responseData.expiresAt as string | number) : null;

    if (expiresAt && expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "Export link has expired" },
        { status: 410 }
      );
    }

    if (!fileName) {
      return NextResponse.json(
        { error: "Export file not available" },
        { status: 404 }
      );
    }

    if (!process.env.REPORTS_DIR) {
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'REPORTS_DIR is not configured');
    }
    const reportsDir = process.env.REPORTS_DIR;
    // Sanitize fileName to prevent path traversal
    const sanitizedFileName = path.basename(fileName);
    const filePath = path.join(reportsDir, sanitizedFileName);
    // Verify the resolved path stays within the reports directory
    const resolvedReportsDir = path.resolve(reportsDir);
    const resolvedFilePath = path.resolve(filePath);
    if (!resolvedFilePath.startsWith(resolvedReportsDir + path.sep)) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid file path'
      );
    }

    const stat = await fs.promises.stat(filePath).catch(() => null);
    if (!stat) {
      return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Export file not found'
    );
    }

    const requestDetails = gdprRequest.requestDetails as Record<string, unknown> | null;
    const format = (requestDetails?.preferredFormat as string) || "json";
    const contentType = format === "csv"
      ? "text/csv"
      : format === "xml"
      ? "application/xml"
      : "application/json";

    const stream = fs.createReadStream(filePath);

    return new NextResponse(stream as any as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(sanitizedFileName)}`,
        "Content-Length": stat.size.toString(),
      },
    });
  } catch (error) {
    logger.error('Data export request error', error as Error);
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to download data export',
      error
    );
  }
  },
);

