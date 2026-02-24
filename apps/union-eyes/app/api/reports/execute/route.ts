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
        validation.error.errors
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

    // Log successful execution
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
        success: result.success,
        organizationId,
      },
    });

    return NextResponse.json({
      success: result.success,
      data: result.data,
      rowCount: result.rowCount,
      executionTime: result.executionTimeMs,
    });
  } catch (error: unknown) {
    logApiAuditEvent({
      timestamp: new Date().toISOString(),
      userId: userId || 'unknown',
      endpoint: '/api/reports/execute',
      method: 'POST',
      eventType: 'auth_failed',
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
 * SECURITY: Allowlisted tables and their valid columns
 */
const ALLOWED_TABLES: Record<string, string[]> = {
  'claims': ['id', 'claim_number', 'status', 'amount', 'created_at', 'organization_id', 'claimant_name', 'claim_type'],
  'members': ['id', 'first_name', 'last_name', 'email', 'status', 'created_at', 'organization_id', 'membership_number'],
  'organization_members': ['id', 'first_name', 'last_name', 'email', 'status', 'created_at', 'organization_id'],
  'deadlines': ['id', 'title', 'due_date', 'status', 'created_at', 'organization_id', 'priority'],
  'grievances': ['id', 'grievance_number', 'status', 'created_at', 'organization_id', 'grievance_type'],
};

const ALLOWED_AGGREGATIONS = ['count', 'sum', 'avg', 'min', 'max', 'distinct'];
const ALLOWED_OPERATORS = ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'between', 'in'];
const ALLOWED_SORT_DIRECTIONS = ['asc', 'desc'];

/**
 * SECURITY: Validate report configuration against allowlists
 */
function validateReportConfig(config: ReportConfig): string | null {
  // Validate table name
  if (!ALLOWED_TABLES[config.dataSourceId]) {
    return `Invalid data source: ${config.dataSourceId}`;
  }

  const allowedColumns = ALLOWED_TABLES[config.dataSourceId];

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
      if (!ALLOWED_OPERATORS.includes(filter.operator)) {
        return `Invalid operator: ${filter.operator}`;
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

