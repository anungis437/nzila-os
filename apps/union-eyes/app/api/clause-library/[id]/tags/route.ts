/**
 * GET PATCH DELETE /api/clause-library/[id]/tags
 * -> Django bargaining: /api/bargaining/shared-clause-library/
 * NOTE: auto-resolved from clause-library/[id]/tags
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/bargaining/shared-clause-library/' + id + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/bargaining/shared-clause-library/' + id + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/bargaining/shared-clause-library/' + id + '/', { method: 'DELETE' });
}

