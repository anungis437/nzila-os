/**
 * STUB: budgets table does not exist yet.
 * Returns empty results until proper budgets schema is created.
 * @deprecated Needs migration to create budgets table.
 */
import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi({
  tags: ['Billing'],
  auth: { required: true },
  handler: async () => {
    return NextResponse.json({ data: [], total: 0, _stub: 'budgets_table_pending' });
  },
});

export const POST = withApi({
  tags: ['Billing'],
  auth: { required: true, minRole: 'steward' },
  handler: async () => {
    return NextResponse.json(
      { error: 'Budget creation not yet available — budgets table pending migration' },
      { status: 501 }
    );
  },
});
