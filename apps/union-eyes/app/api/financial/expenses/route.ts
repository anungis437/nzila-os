/**
 * STUB: expenses table does not exist yet.
 * Returns empty results until proper expenses schema is created.
 * @deprecated Needs migration to create expenses table.
 */
import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi({
  tags: ['Billing'],
  auth: { required: true },
  handler: async () => {
    return NextResponse.json({ data: [], total: 0, _stub: 'expenses_table_pending' });
  },
});

export const POST = withApi({
  tags: ['Billing'],
  auth: { required: true, minRole: 'steward' },
  handler: async () => {
    return NextResponse.json(
      { error: 'Expense creation not yet available — expenses table pending migration' },
      { status: 501 }
    );
  },
});
