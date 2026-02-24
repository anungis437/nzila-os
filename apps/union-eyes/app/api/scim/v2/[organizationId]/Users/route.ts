/**
 * GET PATCH DELETE /api/scim/v2/[organizationId]/Users
 * -> Django auth_core: /api/auth_core/scim-configurations/
 * NOTE: auto-resolved from scim/v2/[organizationId]/Users
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ organizationId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { organizationId } = await params;
  return djangoProxy(req, '/api/auth_core/scim-configurations/' + organizationId + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { organizationId } = await params;
  return djangoProxy(req, '/api/auth_core/scim-configurations/' + organizationId + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { organizationId } = await params;
  return djangoProxy(req, '/api/auth_core/scim-configurations/' + organizationId + '/', { method: 'DELETE' });
}

