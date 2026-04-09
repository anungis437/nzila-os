/**
 * Catch-all deprecation route for /api/v2/*
 *
 * All 568 v2 mirror routes have been removed.
 * This catch-all intercepts any remaining v2 traffic,
 * logs the access, and returns a deprecation response
 * pointing to the canonical root API equivalent.
 *
 * Phase 9 — Deprecation System
 */
import { withApi } from '@/lib/api/with-api';
import {
  logDeprecatedAccess,
  deprecatedResponse,
  resolveV2Canonical,
} from '@/lib/api/deprecation';

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

    return deprecatedResponse(v2Path, canonical);
  },
);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
