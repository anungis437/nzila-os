/**
 * GET organization sharing settings — explicitly unavailable until the canonical domain
 * workflow is implemented. The former route returned an unrelated full
 * organizations row through generic CRUD and exposed PATCH/DELETE handlers.
 * No organization row may be read or modified through this alias.
 */
import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ organizationId, params }) => {
    if (!organizationId || !params.id || params.id !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      {
        error: 'GOVERNED_SHARING_SETTINGS_NOT_IMPLEMENTED',
        message: 'Organization sharing settings are unavailable until their canonical settings model, mandate checks, audited updates and rollback are implemented and verified.',
      },
      { status: 501, headers: { 'Cache-Control': 'private, no-store' } },
    );
  },
);
