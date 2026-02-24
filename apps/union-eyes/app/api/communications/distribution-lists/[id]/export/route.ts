/**
 * GET /api/communications/distribution-lists/[id]/export
 * -> Django notifications: /api/notifications/campaigns/
 * NOTE: auto-resolved from communications/distribution-lists/[id]/export
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/notifications/campaigns/' + id + '/');
}

