/**
 * GET PATCH DELETE /api/arbitration/precedents/[id]/documents
 * -> Django bargaining: /api/bargaining/arbitration-decisions/
 * NOTE: auto-resolved from arbitration/precedents/[id]/documents
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/bargaining/arbitration-decisions/' + id + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/bargaining/arbitration-decisions/' + id + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/bargaining/arbitration-decisions/' + id + '/', { method: 'DELETE' });
}

