/**
 * GET PATCH DELETE /api/arrears/escalate/[caseId]
 * -> Django billing: /api/billing/per-capita-remittances/
 * NOTE: auto-resolved from arrears/escalate/[caseId]
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ caseId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { caseId } = await params;
  return djangoProxy(req, '/api/billing/per-capita-remittances/' + caseId + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { caseId } = await params;
  return djangoProxy(req, '/api/billing/per-capita-remittances/' + caseId + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { caseId } = await params;
  return djangoProxy(req, '/api/billing/per-capita-remittances/' + caseId + '/', { method: 'DELETE' });
}

