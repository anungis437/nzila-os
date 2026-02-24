/**
 * GET /api/admin/employment/member/[memberId]/history
 * -> Django auth_core: /api/auth_core/organization-members/
 * NOTE: auto-resolved from admin/employment/member/[memberId]/history
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

