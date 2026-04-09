/**
 * GET /api/deprecations
 *
 * Returns the complete registry of deprecated routes and their
 * canonical replacements. Public documentation endpoint.
 *
 * Phase 9 — Deprecation System
 */
import { NextResponse } from 'next/server';
import { DEPRECATED_ROUTE_MAP } from '@/lib/api/deprecation';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    deprecated_routes: DEPRECATED_ROUTE_MAP,
    total: DEPRECATED_ROUTE_MAP.length,
    sunset: '2026-07-07T00:00:00Z',
    _note: 'Routes listed here return Deprecation headers and will be fully removed after the sunset date.',
  });
}
