/**
 * GET /api/reports/[id]/run
 * -> Django analytics: /api/analytics/reports/
 * NOTE: auto-resolved from reports/[id]/run
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/analytics/reports/' + id + '/');
}

