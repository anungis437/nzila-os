/**
 * GET PATCH DELETE /api/bargaining/negotiations/[id]
 * -> Django bargaining: /api/bargaining/negotiations/
 * NOTE: auto-resolved from bargaining/negotiations/[id]
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/bargaining/negotiations/' + id + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/bargaining/negotiations/' + id + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/bargaining/negotiations/' + id + '/', { method: 'DELETE' });
}

