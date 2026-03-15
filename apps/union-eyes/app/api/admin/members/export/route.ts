/**
 * GET /api/admin/members/export
 * -> Django auth_core: /api/auth_core/organization-members/
 * NOTE: auto-resolved from admin/members/export
 * Auto-migrated by scripts/migrate_routes.py
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'admin' as const } },
  async ({ request }) => {
    return djangoProxy(request, '/api/auth_core/organization-members/');
  },
);

