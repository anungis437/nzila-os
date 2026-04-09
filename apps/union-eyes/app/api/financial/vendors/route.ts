/**
 * STUB: vendors table does not exist yet.
 * Returns empty results until proper vendors schema is created.
 * @deprecated Needs migration to create vendors table.
 */
import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi({
  auth: { required: true },
}, async () => {
  return NextResponse.json({ data: [], total: 0, _stub: 'vendors_table_pending' });
});

export const POST = withApi({
  auth: { required: true, minRole: 'steward' },
}, async () => {
  return NextResponse.json(
    { error: 'Vendor creation not yet available — vendors table pending migration' },
    { status: 501 }
  );
});
