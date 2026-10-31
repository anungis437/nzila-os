/**
 * Feature Flags Admin API
 * 
 * GET /api/admin/feature-flags - List all flags
 * PATCH /api/admin/feature-flags - Toggle a flag
 */

import { NextResponse } from 'next/server';
import {
  getAllFeatureFlags,
  setFeatureFlagEnabledInTransaction,
  invalidateFeatureFlagCache,
  FeatureFlagNotFoundError,
} from '@/lib/feature-flags';
import { z } from 'zod';
import { logApiAuditEvent } from '@/lib/middleware/api-security';
import { performAtomicAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit';
import { withAdminAuth, withSystemAdminAuth, type BaseAuthContext } from '@/lib/api-auth-guard';

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
 *
 * Feature flags are platform-wide (no organization_id column — see
 * db/schema/domains/infrastructure/features.ts), so mutating one affects
 * every organization on the platform. round 51: this MUST require genuine
 * platform authority (withSystemAdminAuth -> isSystemAdmin()), not an
 * ordinary per-organization "admin" role (withAdminAuth ->
 * hasMinRole('admin')) — any org's own admin previously had authority to
 * flip a platform-wide kill switch. The dead org-mismatch check below
 * (comparing body.organizationId to context.organizationId) never fired in
 * practice since toggleFlagSchema strips unknown fields before this code
 * runs, and is superseded by the platform-admin requirement.
 */
export const PATCH = withSystemAdminAuth(async (request, context: BaseAuthContext) => {
  let rawBody: any;
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

      // A platform-wide flag is rows in our own database: the change and its audit record commit in one transaction, so a failed audit
      // write leaves the flag as it was. The in-memory cache is refreshed only after the commit.
      await performAtomicAuditedOperation(
        {
          organizationId,
          userId,
          action: 'platform.feature_flag.toggle',
          resourceType: 'feature_flag',
          resourceId: name,
          details: { enabled },
        },
        (tx) => setFeatureFlagEnabledInTransaction(tx, name, enabled),
        invalidateFeatureFlagCache,
      );

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
if (error instanceof FeatureFlagNotFoundError) {
        return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Feature flag not found');
      }
      const refused = operationAuditResponse(error);
      if (refused) return NextResponse.json(refused.body, { status: refused.status });
      throw error;
    }
});


