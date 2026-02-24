/**
 * GET PATCH DELETE /api/admin/users/[userId]
 * -> Django auth_core: /api/auth_core/organization-members/
 * NOTE: auto-resolved from admin/users/[userId]
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ userId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { userId } = await params;
  return djangoProxy(req, '/api/auth_core/organization-members/' + userId + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { userId } = await params;
  return djangoProxy(req, '/api/auth_core/organization-members/' + userId + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { userId } = await params;
  return djangoProxy(req, '/api/auth_core/organization-members/' + userId + '/', { method: 'DELETE' });
}

