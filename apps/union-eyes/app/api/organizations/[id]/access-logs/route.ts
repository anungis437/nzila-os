/**
 * GET cross-organization access logs — explicitly unavailable until the canonical domain
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
        error: 'CROSS_ORG_ACCESS_LOG_NOT_IMPLEMENTED',
        message: 'Cross-organization access log reporting is unavailable until its tenant-scoped query, reader mandate, filters and pagination have been implemented and verified.',
      },
      { status: 501, headers: { 'Cache-Control': 'private, no-store' } },
    );
  },
);
