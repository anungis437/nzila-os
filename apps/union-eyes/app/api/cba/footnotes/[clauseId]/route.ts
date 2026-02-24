/**
 * GET PATCH DELETE /api/cba/footnotes/[clauseId]
 * -> Django bargaining: /api/bargaining/collective-agreements/
 * NOTE: auto-resolved from cba/footnotes/[clauseId]
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ clauseId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { clauseId } = await params;
  return djangoProxy(req, '/api/bargaining/collective-agreements/' + clauseId + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { clauseId } = await params;
  return djangoProxy(req, '/api/bargaining/collective-agreements/' + clauseId + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { clauseId } = await params;
  return djangoProxy(req, '/api/bargaining/collective-agreements/' + clauseId + '/', { method: 'DELETE' });
}

