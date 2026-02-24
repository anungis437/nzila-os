/**
 * GET PATCH DELETE /api/dues/remittances/[id]
 * -> Django billing: /api/billing/per-capita-remittances/
 * NOTE: auto-resolved from dues/remittances/[id]
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/billing/per-capita-remittances/' + id + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/billing/per-capita-remittances/' + id + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/billing/per-capita-remittances/' + id + '/', { method: 'DELETE' });
}

