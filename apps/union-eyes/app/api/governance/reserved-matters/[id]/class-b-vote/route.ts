/**
 * GET PATCH DELETE /api/governance/reserved-matters/[id]/class-b-vote
 * -> Django compliance: /api/compliance/data-classification-policy/
 * NOTE: auto-resolved from governance/reserved-matters/[id]/class-b-vote
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

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/compliance/data-classification-policy/' + id + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/compliance/data-classification-policy/' + id + '/', { method: 'DELETE' });
}

