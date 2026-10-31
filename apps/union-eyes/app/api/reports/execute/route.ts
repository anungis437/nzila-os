/**
 * Report Execution API
 * 
 * POST /api/reports/execute - Execute a report configuration and return results
 * Dynamically builds and executes SQL queries based on report config
 * 
 * Created: November 16, 2025
 * Updated: February 11, 2026 - Refactored to use secured ReportExecutor
 * Part of: Area 8 - Analytics Platform
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { ReportExecutor, type ReportConfig } from '@/lib/report-executor';
import { validateReportConfig } from '@/lib/reports/report-config-validation';
import { logApiAuditEvent } from '@/lib/middleware/api-security';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
interface _AuthContext {
  userId: string;
  organizationId: string;
  params?: Record<string, unknown>;
}


const reportsExecuteSchema = z.object({
  config: z.unknown().optional(),
});

export const POST = withRoleAuth('officer', async (request: NextRequest, context) => {
  const { userId, organizationId } = context as { userId: string; organizationId: string };

  try {
    if (!userId || !organizationId) {
      return standardErrorResponse(
      ErrorCode.AUTH_REQUIRED,
      'Unauthorized'
    );
    }

    // Rate limit report execution
    const rateLimitResult = await checkRateLimit(
      `report-execute-adhoc:${userId}`,
      RATE_LIMITS.REPORT_EXECUTION
    );

    if (!rateLimitResult.allowed) {
      logApiAuditEvent({
        timestamp: new Date().toISOString(),
        userId,
        endpoint: '/api/reports/execute',
        method: 'POST',
        eventType: 'auth_failed',
        severity: 'medium',
        details: {
          reason: 'Rate limit exceeded',
          resetIn: rateLimitResult.resetIn,
        },
      });

      return standardErrorResponse(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      { resetIn: rateLimitResult.resetIn }
    );
    }

    const body = await request.json();
    // Validate request body
    const validation = reportsExecuteSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.issues
      );
    }
    
    const config = validation.data.config as ReportConfig | undefined;

    if (!config || !config.dataSourceId || !config.fields || config.fields.length === 0) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid report configuration'
    );
    }

    // SECURITY: Validate config before execution
    const validationError = validateReportConfig(config);
    if (validationError) {
      logApiAuditEvent({
        timestamp: new Date().toISOString(),
        userId,
        endpoint: '/api/reports/execute',
        method: 'POST',
        eventType: 'validation_failed',
        severity: 'medium',
        details: {
          reason: validationError,
          dataSource: config.dataSourceId,
          organizationId,
        },
      });

      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    // Execute report using secured ReportExecutor
    const executor = new ReportExecutor(organizationId);
    const result = await executor.execute(config);

    // A refused configuration is the caller's error and a failed query is ours; neither is a 200, and neither is recorded as a success.
    if (!result.success) {
      const refused = result.kind === 'invalid';
      logApiAuditEvent({
        timestamp: new Date().toISOString(),
        userId,
        endpoint: '/api/reports/execute',
        method: 'POST',
        eventType: refused ? 'validation_failed' : 'failure',
        severity: refused ? 'medium' : 'high',
        details: { dataSource: config.dataSourceId, organizationId, reason: result.error ?? 'Report execution failed' },
      });
      return refused
        ? NextResponse.json({ error: result.error ?? 'Invalid report configuration' }, { status: 400 })
        : standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to execute report');
    }

    logApiAuditEvent({
      timestamp: new Date().toISOString(),
      userId,
      endpoint: '/api/reports/execute',
      method: 'POST',
      eventType: 'success',
      severity: 'low',
      details: {
        dataSource: config.dataSourceId,
        fieldCount: config.fields.length,
        filterCount: config.filters?.length || 0,
        rowCount: result.rowCount,
        executionTime: result.executionTimeMs,
        organizationId,
      },
    });

    // What was returned is recorded durably, by source and fields and the number of rows, never the rows themselves: a report can carry
    // member contact and case data, and the answer must leave a record the log line did not.
    await withRLSContext({ organizationId, userId }, (tx) =>
      persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'report.execute',
        resourceType: 'report_execution',
        details: {
          dataSource: config.dataSourceId,
          fields: config.fields.map((field) => field.fieldId).slice(0, 100),
          filterCount: config.filters?.length ?? 0,
          rowCount: result.rowCount,
        },
      }),
    );

    return NextResponse.json({
      success: true,
      data: result.data,
      rowCount: result.rowCount,
      executionTime: result.executionTimeMs,
    });
  } catch (error: any) {
    logApiAuditEvent({
      timestamp: new Date().toISOString(),
      userId: userId || 'unknown',
      endpoint: '/api/reports/execute',
      method: 'POST',
      eventType: 'failure',
      severity: 'high',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: organizationId || 'unknown',
      },
    });

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to execute report',
      error
    );
  }
});
