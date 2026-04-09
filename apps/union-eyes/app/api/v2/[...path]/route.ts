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
import { NextRequest } from 'next/server';
import {
  logDeprecatedAccess,
  deprecatedResponse,
  resolveV2Canonical,
} from '@/lib/api/deprecation';

export const dynamic = 'force-dynamic';

async function handleDeprecated(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const v2Path = `/api/v2/${path.join('/')}`;
  const canonical = resolveV2Canonical(v2Path);

  // Fire-and-forget usage logging
  logDeprecatedAccess(v2Path, request.method, canonical);

  return deprecatedResponse(v2Path, canonical);
}

export const GET = handleDeprecated;
export const POST = handleDeprecated;
export const PUT = handleDeprecated;
export const PATCH = handleDeprecated;
export const DELETE = handleDeprecated;
