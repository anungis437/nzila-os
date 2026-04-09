/**
 * Route Deprecation System
 *
 * Marks routes as deprecated, logs usage, and provides migration mapping.
 * Returns standard HTTP Deprecation/Sunset headers per RFC 8594.
 *
 * @module lib/api/deprecation
 */

import { NextResponse } from 'next/server';
import { auditLog } from '@/lib/audit-logger';
import { logger } from '@/lib/logger';

/** Sunset date for deprecated routes — 90 days from Phase 9 deployment */
const SUNSET_DATE = new Date('2026-07-07T00:00:00Z');

export interface DeprecatedRouteMapping {
  /** Original deprecated path pattern (e.g. '/api/v2/members/dues') */
  deprecated: string;
  /** Canonical replacement path (e.g. '/api/members/dues') */
  canonical: string;
  /** Reason for deprecation */
  reason: string;
  /** Phase in which the route was deprecated */
  phase: number;
}

/**
 * Registry of deprecated route → canonical route mappings.
 * Used by the v2 catch-all and deprecation report endpoint.
 */
export const DEPRECATED_ROUTE_MAP: DeprecatedRouteMapping[] = [
  // ── Phase 0+1: Security + Hard Cleanup ────────────────────────────────────
  { deprecated: '/api/v1/claims', canonical: '/api/claims', reason: 'Legacy v1 endpoint', phase: 1 },
  { deprecated: '/api/v1/reports/membership', canonical: '/api/reports', reason: 'Misnamed — was CRUD on claims table', phase: 1 },
  { deprecated: '/api/cba/search', canonical: '/api/cbas', reason: 'Duplicate of /api/cbas', phase: 1 },
  { deprecated: '/api/cba/[id]', canonical: '/api/cbas/[id]', reason: 'Consolidated under /api/cbas', phase: 1 },
  { deprecated: '/api/cba/clauses/compare', canonical: '/api/clause-library/compare', reason: 'Moved to clause-library domain', phase: 1 },
  { deprecated: '/api/cba/footnotes/[clauseId]', canonical: '/api/cbas/[id]', reason: 'Merged into CBA detail', phase: 1 },
  { deprecated: '/api/cba/precedents', canonical: '/api/precedents', reason: 'Moved to standalone domain', phase: 1 },
  { deprecated: '/api/organization/switch', canonical: '/api/org/switch', reason: 'Dead stub — no logic', phase: 1 },
  { deprecated: '/api/organization/current', canonical: '/api/org', reason: 'Merged into org endpoint', phase: 1 },
  { deprecated: '/api/payments/webhooks/stripe', canonical: '/api/payments/webhooks', reason: 'Consolidated webhook handler', phase: 1 },
  { deprecated: '/api/user/status', canonical: '/api/auth/session', reason: 'Replaced by session endpoint', phase: 1 },
  { deprecated: '/api/messaging/preferences', canonical: '/api/notifications/preferences', reason: 'Merged into notifications', phase: 1 },
  { deprecated: '/api/auth/debug-role', canonical: 'REMOVED', reason: 'Security fix — debug endpoint removed', phase: 0 },

  // ── Phase 2: Financial Surface Consolidation ──────────────────────────────
  { deprecated: '/api/financial/reports/aged-receivables', canonical: '/api/billing/reports', reason: 'Consolidated into billing reports', phase: 2 },
  { deprecated: '/api/financial/reports/balance-sheet', canonical: '/api/billing/reports', reason: 'Consolidated into billing reports', phase: 2 },
  { deprecated: '/api/financial/reports/cash-flow', canonical: '/api/billing/reports', reason: 'Consolidated into billing reports', phase: 2 },
  { deprecated: '/api/financial/reports/income-statement', canonical: '/api/billing/reports', reason: 'Consolidated into billing reports', phase: 2 },
  { deprecated: '/api/v2/billing/*', canonical: '/api/billing/*', reason: 'v2 mirror removed — use root billing', phase: 2 },
  { deprecated: '/api/v2/dues/*', canonical: '/api/dues/*', reason: 'v2 mirror removed — use root dues', phase: 2 },
  { deprecated: '/api/v2/financial/*', canonical: '/api/financial/*', reason: 'v2 mirror removed — use root financial', phase: 2 },
  { deprecated: '/api/v2/payments/*', canonical: '/api/payments/*', reason: 'v2 mirror removed — use root payments', phase: 2 },

  // ── Phase 4: API Duplicate Consolidation ──────────────────────────────────
  { deprecated: '/api/messaging/campaigns', canonical: '/api/messages', reason: 'Duplicate of messages — same table', phase: 4 },
  { deprecated: '/api/messaging/campaigns/[id]', canonical: '/api/messages/[id]', reason: 'Duplicate of messages — same table', phase: 4 },
  { deprecated: '/api/messaging/campaigns/[id]/send', canonical: '/api/messages', reason: 'Merged into messages workflow', phase: 4 },
  { deprecated: '/api/strike-fund/applications', canonical: '/api/strike/fund', reason: 'Merged into strike fund domain', phase: 4 },

  // ── Phase 9: v2 Mirror Wholesale Deprecation ──────────────────────────────
  { deprecated: '/api/v2/*', canonical: '/api/*', reason: 'v2 mirror — identical copy of root API', phase: 9 },

  // ── Stub Cleanup: Tables Never Created ────────────────────────────────────
  { deprecated: '/api/financial/vendors', canonical: '/api/billing/reports', reason: 'Vendors table never created', phase: 9 },
  { deprecated: '/api/financial/vendors/[id]', canonical: '/api/billing/reports', reason: 'Vendors table never created', phase: 9 },
  { deprecated: '/api/financial/expenses', canonical: '/api/billing/reports', reason: 'Expenses table never created', phase: 9 },
  { deprecated: '/api/financial/expenses/[id]', canonical: '/api/billing/reports', reason: 'Expenses table never created', phase: 9 },
  { deprecated: '/api/financial/budgets', canonical: '/api/billing/reports', reason: 'Budgets table never created', phase: 9 },
  { deprecated: '/api/financial/budgets/[id]', canonical: '/api/billing/reports', reason: 'Budgets table never created', phase: 9 },
];

/**
 * Log a deprecated route access via the audit system.
 */
export async function logDeprecatedAccess(
  path: string,
  method: string,
  canonical: string | undefined,
  userId?: string,
  organizationId?: string,
): Promise<void> {
  logger.warn('Deprecated route accessed', {
    deprecatedPath: path,
    method,
    canonicalPath: canonical || 'REMOVED',
    sunset: SUNSET_DATE.toISOString(),
  });

  await auditLog({
    eventType: 'api.deprecated_access',
    severity: 'medium' as never,
    userId,
    organizationId,
    resource: 'deprecated_route',
    action: 'access',
    details: {
      deprecatedPath: path,
      method,
      canonicalPath: canonical || 'REMOVED',
      sunsetDate: SUNSET_DATE.toISOString(),
    },
    outcome: 'success',
  }).catch(() => {
    // Non-critical — don't fail the request if audit logging fails
  });
}

/**
 * Build a JSON deprecation response with standard HTTP headers.
 */
export function deprecatedResponse(
  deprecatedPath: string,
  canonicalPath: string,
  body?: unknown,
): NextResponse {
  const res = NextResponse.json(
    {
      _deprecated: true,
      _message: `This endpoint is deprecated. Use ${canonicalPath} instead.`,
      _sunset: SUNSET_DATE.toISOString(),
      _canonical: canonicalPath,
      ...(body && typeof body === 'object' ? body : {}),
    },
    { status: 200 },
  );

  // RFC 8594 headers
  res.headers.set('Deprecation', 'true');
  res.headers.set('Sunset', SUNSET_DATE.toUTCString());
  res.headers.set('Link', `<${canonicalPath}>; rel="successor-version"`);

  return res;
}

/**
 * Build a 410 Gone response for fully removed routes.
 */
export function goneResponse(deprecatedPath: string, reason: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Gone',
      message: `${deprecatedPath} has been permanently removed. ${reason}`,
      _deprecated: true,
      _removedInPhase: 'Phase 9',
    },
    { status: 410 },
  );
}

/**
 * Resolve the canonical path for a v2 mirror route.
 * Strips the /v2 prefix to get the root equivalent.
 */
export function resolveV2Canonical(v2Path: string): string {
  return v2Path.replace(/^\/api\/v2\//, '/api/');
}
