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
import { ReportExecutor, getDataSource, type ReportConfig } from '@/lib/report-executor';
import { logApiAuditEvent } from '@/lib/middleware/api-security';

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

/**
 * SECURITY: the data sources and columns a report may use are those of the executor's registry (the same ones /api/reports/datasources
 * advertises); the executor refuses anything else, so this route keeps no second, different list.
 */
const ALLOWED_AGGREGATIONS = ['count', 'sum', 'avg', 'min', 'max', 'distinct'];
// The executor's own vocabulary. The names this route used to accept (equals, contains, ...) were not the executor's, and the executor skipped
// a filter whose operator it did not know, so such a filter was dropped and every row came back. The earlier names are translated, and
// anything else is refused.
const ALLOWED_OPERATORS = ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'like', 'ilike', 'in', 'not_in', 'is_null', 'is_not_null', 'between'];
const LEGACY_OPERATORS: Record<string, string> = { equals: 'eq', not_equals: 'ne', contains: 'ilike', greater_than: 'gt', less_than: 'lt' };
const ALLOWED_SORT_DIRECTIONS = ['asc', 'desc'];

/**
 * SECURITY: Validate report configuration against allowlists
 */
function validateReportConfig(config: ReportConfig): string | null {
  const source = getDataSource(config.dataSourceId);
  if (!source) {
    return `Invalid data source: ${config.dataSourceId}`;
  }

  const allowedColumns = source.fields.map((field) => field.id);

  // SECURITY: Block custom formulas (P0 protection)
  for (const field of config.fields) {
    if (field && typeof field === 'object' && 'formula' in field) {
      return 'Custom formulas are not supported for security reasons';
    }
  }

  // Validate all field IDs
  for (const field of config.fields) {
    if (!allowedColumns.includes(field.fieldId)) {
      return `Invalid field: ${field.fieldId}`;
    }
    if (field.aggregation && !ALLOWED_AGGREGATIONS.includes(field.aggregation)) {
      return `Invalid aggregation: ${field.aggregation}`;
    }
    if (field.alias && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.alias)) {
      return `Invalid alias format: ${field.alias}`;
    }
  }

  // Validate filters
  if (config.filters) {
    for (const filter of config.filters) {
      if (!allowedColumns.includes(filter.fieldId)) {
        return `Invalid filter field: ${filter.fieldId}`;
      }
      const translated = LEGACY_OPERATORS[filter.operator as string];
      if (translated) (filter as { operator: string }).operator = translated;
      if (!ALLOWED_OPERATORS.includes(filter.operator)) {
        return `Invalid operator: ${filter.operator}`;
      }
      const needsList = filter.operator === 'in' || filter.operator === 'not_in';
      const values = (filter as { values?: unknown }).values;
      if ((needsList || filter.operator === 'between') && (!Array.isArray(values) || values.length === 0 || (filter.operator === 'between' && values.length !== 2) || values.length > 100)) {
        return `Operator ${filter.operator} needs ${filter.operator === 'between' ? 'exactly two' : 'a bounded list of'} values`;
      }
    }
  }

  // Validate groupBy
  if (config.groupBy) {
    for (const field of config.groupBy) {
      if (!allowedColumns.includes(field)) {
        return `Invalid group by field: ${field}`;
      }
    }
  }

  // Validate sortBy
  if (config.sortBy) {
    for (const sort of config.sortBy) {
      if (!allowedColumns.includes(sort.fieldId)) {
        return `Invalid sort field: ${sort.fieldId}`;
      }
      if (!ALLOWED_SORT_DIRECTIONS.includes(sort.direction)) {
        return `Invalid sort direction: ${sort.direction}`;
      }
    }
  }

  return null;
}

