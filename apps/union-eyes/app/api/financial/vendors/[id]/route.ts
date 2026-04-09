/**
 * STUB: vendors table does not exist yet.
 * @deprecated Needs migration to create vendors table.
 */
import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi({
  auth: { required: true },
}, async () => {
  return NextResponse.json(
    { error: 'Vendor not found — vendors table pending migration' },
    { status: 404 }
  );
});

export const PATCH = withApi({
  auth: { required: true, minRole: 'steward' },
}, async () => {
  return NextResponse.json(
    { error: 'Vendor updates not yet available — vendors table pending migration' },
    { status: 501 }
  );
});

export const DELETE = withApi({
  auth: { required: true, minRole: 'admin' },
}, async () => {
  return NextResponse.json(
    { error: 'Vendor deletion not yet available — vendors table pending migration' },
    { status: 501 }
  );
});
