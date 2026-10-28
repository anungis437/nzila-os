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
  async ({ request, params }) => {
    const pathSegments = (params as Record<string, string | string[]>).path;
    const pathArray = Array.isArray(pathSegments) ? pathSegments : [pathSegments];
    const v2Path = `/api/v2/${pathArray.join('/')}`;
    const canonical = resolveV2Canonical(v2Path);

    // Fire-and-forget usage logging
    logDeprecatedAccess(v2Path, request.method, canonical);

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
