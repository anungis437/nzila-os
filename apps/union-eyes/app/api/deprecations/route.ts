/**
 * GET /api/deprecations
 *
 * Returns the complete registry of deprecated routes and their
 * canonical replacements. Requires authentication (member+).
 *
 * Phase 9 — Deprecation System
 */
import { withApi } from '@/lib/api/with-api';
import { DEPRECATED_ROUTE_MAP } from '@/lib/api/deprecation';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Platform'],
      summary: 'Deprecated routes registry',
      description: 'Returns the complete registry of deprecated routes and their canonical replacements.',
    },
  },
  async () => {
    return {
      deprecated_routes: DEPRECATED_ROUTE_MAP,
      total: DEPRECATED_ROUTE_MAP.length,
      sunset: '2026-07-07T00:00:00Z',
      _note: 'Routes listed here return Deprecation headers and will be fully removed after the sunset date.',
    };
  },
);
