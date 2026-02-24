/**
 * GET /api/governance/elections/sessions/[id]/results
 * -> Django compliance: /api/compliance/data-classification-policy/
 * NOTE: auto-resolved from governance/elections/sessions/[id]/results
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/compliance/data-classification-policy/' + id + '/');
}

