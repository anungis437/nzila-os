/**
 * Catch-all deprecation route for /api/v2/*
 *
 * All 568 v2 mirror routes have been removed. This catch-all intercepts any remaining v2 traffic, logs the access and
 * answers 410 Gone for every method. It never answers 2xx: a 200 here told a caller that a write (a role change, a
 * remittance approval, a generated report) had succeeded when nothing was processed or persisted.
 *
 * Phase 9 — Deprecation System
 */
import { withApi } from '@/lib/api/with-api';
import { logger } from '@/lib/logger';
import { logDeprecatedAccess, goneResponse, resolveV2Canonical } from '@/lib/api/deprecation';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Deprecated'],
      summary: 'Deprecated — v2 routes removed',
      deprecated: true,
    },
  },
  async ({ request, params, userId, organizationId }) => {
    const pathSegments = (params as Record<string, string | string[]>).path;
    const pathArray = Array.isArray(pathSegments) ? pathSegments : [pathSegments];
    const v2Path = `/api/v2/${pathArray.join('/')}`;
    const canonical = resolveV2Canonical(v2Path);

    // The access is recorded with the caller and organization, and awaited so the record is written before the answer; a
    // failure to record it is logged and does not change the 410.
    try {
      await logDeprecatedAccess(v2Path, request.method, canonical, userId ?? undefined, organizationId ?? undefined);
    } catch (error) {
      logger.warn('Deprecated route access could not be recorded', { deprecatedPath: v2Path, error: String(error) });
    }

    return goneResponse(
      v2Path,
      'The request was not processed and nothing was changed. Use the root API route, if one exists for this capability.',
    );
  },
);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
