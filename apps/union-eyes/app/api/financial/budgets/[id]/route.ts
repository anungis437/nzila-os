/**
 * STUB: budgets table does not exist yet.
 * @deprecated Needs migration to create budgets table.
 */
import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi({
  auth: { required: true },
}, async () => {
  return NextResponse.json(
    { error: 'Budget not found — budgets table pending migration' },
    { status: 404 }
  );
});

export const PATCH = withApi({
  auth: { required: true, minRole: 'steward' },
}, async () => {
  return NextResponse.json(
    { error: 'Budget updates not yet available — budgets table pending migration' },
    { status: 501 }
  );
});

export const DELETE = withApi({
  auth: { required: true, minRole: 'admin' },
}, async () => {
  return NextResponse.json(
    { error: 'Budget deletion not yet available — budgets table pending migration' },
    { status: 501 }
  );
});
