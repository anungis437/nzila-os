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
import { hasMinRole, withRoleAuth } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { ReportExecutor, type ReportConfig } from '@/lib/report-executor';
import { OFFICER_REPORT_ROW_CAP, suppressSmallGroups, validateReportConfig, withGroupSizeField } from '@/lib/reports/report-config-validation';
import { isCellReport } from '@/lib/reports/report-disclosure-limits';
import { assessReportDisclosure, REPORT_FIELD_POLICY } from '@/lib/reports/report-field-authority';
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

// An officer may ask the same question of the same source and grouping only so many times an hour with different values: the answers of
// near-identical questions can be subtracted from each other, so probing that way is bounded and every question's shape is recorded.
const REPORT_SHAPE_BUDGET = { limit: 12, window: 3600, identifier: 'report-shape' };

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

    // The officer role title opens aggregate reporting; listing member or matter data, and anything that touches an identifier (member id, name,
    // e-mail, claim number, assignee), needs an administrator. A refusal is recorded, so the attempt is visible. Anyone below administrator
    // also gets a bounded page, and a result of cells that are too small to be anonymous is withheld.
    const disclosure = assessReportDisclosure(config);
    const adminOnly = disclosure.restricted;
    const isAdministrator = await hasMinRole('admin');
    if (adminOnly.length > 0 && !isAdministrator) {
      await withRLSContext({ organizationId, userId }, (tx) =>
        persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'report.execute.denied',
          resourceType: 'report_execution',
          details: { dataSource: config.dataSourceId, restricted: adminOnly },
        }, 'failure'),
      );
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        'This report lists member or matter data (' + adminOnly.join(', ') + ') and needs an administrator',
      );
    }
    const cellReport = !isAdministrator && isCellReport(config);
    if (cellReport) {
      const budget = await checkRateLimit(`report-shape:${organizationId}:${userId}:${disclosure.shape}`, REPORT_SHAPE_BUDGET);
      if (!budget.allowed) {
        await withRLSContext({ organizationId, userId }, (tx) =>
          persistAtomicAudit(tx, {
            organizationId,
            userId,
            action: 'report.execute.denied',
            resourceType: 'report_execution',
            details: { dataSource: config.dataSourceId, reason: 'repeated_question_shape', shape: disclosure.shape },
          }, 'failure'),
        );
        return standardErrorResponse(
          ErrorCode.RATE_LIMIT_EXCEEDED,
          'This question has been asked too many times with different values; ask a different question or have an administrator run it',
          { resetIn: budget.resetIn },
        );
      }
    }
    if (!isAdministrator) {
      const requested = typeof config.limit === 'number' && Number.isFinite(config.limit) && config.limit > 0 ? config.limit : OFFICER_REPORT_ROW_CAP;
      config.limit = Math.min(requested, OFFICER_REPORT_ROW_CAP);
    }

    // Execute report using secured ReportExecutor
    const executor = new ReportExecutor(organizationId);
    // An officer's cell report withholds cells too small to be anonymous; the server adds the counts it measures them by.
    const result = await executor.execute(cellReport ? withGroupSizeField(config) : config);

    let suppressedGroups = 0;
    if (result.success && cellReport) {
      const filtered = suppressSmallGroups((result.data ?? []) as Array<Record<string, unknown>>);
      result.data = filtered.rows;
      result.rowCount = filtered.rows.length;
      suppressedGroups = filtered.suppressed + filtered.complementary;
    }

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
          // Names of what was selected, filtered on, grouped by and sorted by, and the classes of what came back. Never the rows or the filter values.
          fields: disclosure.selected.slice(0, 100),
          filteredBy: disclosure.filtered.slice(0, 50),
          groupedBy: disclosure.grouped.slice(0, 50),
          sortedBy: disclosure.sorted.slice(0, 50),
          classesReturned: disclosure.classesReturned,
          authority: isAdministrator ? 'administrator' : 'officer',
          fieldPolicy: { version: REPORT_FIELD_POLICY.version, approvedBy: REPORT_FIELD_POLICY.approvedBy },
          questionShape: disclosure.shape,
          filterCount: config.filters?.length ?? 0,
          rowCount: result.rowCount,
          adminOnlySelections: adminOnly,
          suppressedGroups,
          limit: config.limit ?? null,
        },
      }),
    );

    return NextResponse.json({
      success: true,
      data: result.data,
      rowCount: result.rowCount,
      executionTime: result.executionTimeMs,
      ...(suppressedGroups > 0 ? { suppressedGroups, suppressionNote: 'Groups with fewer than 5 members or claims are withheld.' } : {}),
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
