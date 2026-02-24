/**
 * Feature Flags Admin API
 * 
 * GET /api/admin/feature-flags - List all flags
 * PATCH /api/admin/feature-flags - Toggle a flag
 */

import { NextResponse } from 'next/server';
import { getAllFeatureFlags, toggleFeatureFlag } from '@/lib/feature-flags';
import { z } from 'zod';
import { logApiAuditEvent } from '@/lib/middleware/api-security';
import { withAdminAuth, type BaseAuthContext } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Validation schemas
 */
const toggleFlagSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean(),
});

/**
 * Get all feature flags
 */
export const GET = withAdminAuth(async (request, context: BaseAuthContext) => {
  const { userId } = context;

  const flags = await getAllFeatureFlags();

  logApiAuditEvent({
    timestamp: new Date().toISOString(), userId,
    endpoint: '/api/admin/feature-flags',
    method: 'GET',
    eventType: 'success',
    severity: 'low',
    details: { flagCount: Object.keys(flags).length },
  });

  return NextResponse.json(flags);
});

/**
 * Toggle a feature flag
 */
export const PATCH = withAdminAuth(async (request, context: BaseAuthContext) => {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid JSON in request body'
    );
  }

  const parsed = toggleFlagSchema.safeParse(rawBody);
  if (!parsed.success) {
    return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid request body',
      parsed.error
    );
  }

  const body = parsed.data;
  const { userId, organizationId } = context;

  const orgId = (body as Record<string, unknown>)["organizationId"] ?? (body as Record<string, unknown>)["orgId"] ?? (body as Record<string, unknown>)["organization_id"] ?? (body as Record<string, unknown>)["org_id"] ?? (body as Record<string, unknown>)["unionId"] ?? (body as Record<string, unknown>)["union_id"] ?? (body as Record<string, unknown>)["localId"] ?? (body as Record<string, unknown>)["local_id"];
  if (typeof orgId === 'string' && orgId.length > 0 && orgId !== organizationId) {
    return standardErrorResponse(
      ErrorCode.FORBIDDEN,
      'Forbidden'
    );
  }

try {

      const { name, enabled } = body;

      await toggleFeatureFlag(name, enabled);

      logApiAuditEvent({
        timestamp: new Date().toISOString(), userId,
        endpoint: '/api/admin/feature-flags',
        method: 'PATCH',
        eventType: 'success',
        severity: 'medium',
        details: { flagName: name, enabled },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      logApiAuditEvent({
        timestamp: new Date().toISOString(), userId,
        endpoint: '/api/admin/feature-flags',
        method: 'PATCH',
        eventType: 'auth_failed',
        severity: 'high',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
throw error;
    }
});

