/**
 * GDPR Data Export API (Article 15)
 * POST /api/gdpr/data-export - Request data export
 * GET /api/gdpr/data-export - Download exported data
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, getCurrentUser } from '@/lib/api-auth-guard';
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
/**
 * Request data export
 */

const gdprDataExportSchema = z.object({
  organizationId: z.string().uuid('Invalid organizationId'),
  preferredFormat: z.string().optional(),
  requestDetails: z.record(z.unknown()).optional(),
});

export const POST = withApiAuth(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return standardErrorResponse(
      ErrorCode.AUTH_REQUIRED,
      'Unauthorized'
    );
    }
    
    const userId = user.id;
    const body = await request.json();
    // Validate request body
    const validation = gdprDataExportSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { organizationId, preferredFormat, requestDetails } = validation.data;
    const format = preferredFormat || "json";

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

    // Create data access request
    const gdprRequest = await GdprRequestManager.requestDataAccess({
      userId: userId,
      organizationId,
      requestDetails: {
        preferredFormat: format,
        ...(requestDetails ?? {}),
      },
      verificationMethod: "email",
    });

    await GdprRequestManager.updateRequestStatus(gdprRequest.id, "in_progress", {
      processedBy: "system",
    });

    try {
      const queue = getReportQueue();
      if (!queue) {
        throw new Error("Report queue not available");
      }

      await (queue as unknown as { add: (...args: unknown[]) => Promise<unknown> }).add(
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
    } catch (queueError) {
      logger.error("Failed to queue GDPR export job", queueError as Error);
    }

    return NextResponse.json({
      success: true,
      requestId: gdprRequest.id,
      status: "processing",
      message: "Your data export request has been received and is being processed",
      estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to process data export request',
      error
    );
  }
});

/**
 * Download exported data
 */
export const GET = withApiAuth(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return standardErrorResponse(
      ErrorCode.AUTH_REQUIRED,
      'Unauthorized'
    );
    }
    
    const userId = user.id;
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("requestId");
    const organizationIdFromQuery = searchParams.get("organizationId") ?? searchParams.get("orgId") ?? searchParams.get("organization_id") ?? searchParams.get("org_id");

    if (!requestId || !organizationIdFromQuery) {
      return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Request ID and Organization ID required'
    );
    }

    // Get request status
    const requests = await GdprRequestManager.getUserRequests(userId, organizationIdFromQuery);
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

    const reportsDir = process.env.REPORTS_DIR || "./reports";
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

    return new NextResponse(stream as unknown as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
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
});

