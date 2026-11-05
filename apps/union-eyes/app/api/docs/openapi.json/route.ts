/**
 * GET /api/docs/openapi.json — authenticated alias of the canonical OpenAPI specification.
 *
 * The former unauthenticated endpoint published a hand-authored specification
 * with unverified routes, authentication and pricing claims. Do not expose
 * an invented public API contract or the platform operation inventory.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/api-auth-guard';
import { generateOpenAPISpec } from '@/lib/api/openapi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoleAuth('admin', async (_request: NextRequest) =>
  NextResponse.json(generateOpenAPISpec(), {
    headers: { 'Cache-Control': 'private, no-store' },
  }),
);
