/**
 * GET PATCH DELETE /api/admin/employment/member/[memberId]
 * -> Django auth_core: /api/auth_core/organization-members/
 * NOTE: auto-resolved from admin/employment/member/[memberId]
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ memberId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { memberId } = await params;
  return djangoProxy(req, '/api/auth_core/organization-members/' + memberId + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { memberId } = await params;
  return djangoProxy(req, '/api/auth_core/organization-members/' + memberId + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { memberId } = await params;
  return djangoProxy(req, '/api/auth_core/organization-members/' + memberId + '/', { method: 'DELETE' });
}

