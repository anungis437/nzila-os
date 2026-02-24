/**
 * GET PATCH DELETE /api/arrears/case/[memberId]
 * -> Django billing: /api/billing/per-capita-remittances/
 * NOTE: auto-resolved from arrears/case/[memberId]
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ memberId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { memberId } = await params;
  return djangoProxy(req, '/api/billing/per-capita-remittances/' + memberId + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { memberId } = await params;
  return djangoProxy(req, '/api/billing/per-capita-remittances/' + memberId + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { memberId } = await params;
  return djangoProxy(req, '/api/billing/per-capita-remittances/' + memberId + '/', { method: 'DELETE' });
}

