/**
 * External invoices are financial records; a generic member-facing CRUD
 * collection is not an appropriate read surface for customer/balance data.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { FINANCIAL_MEMBER_DATA_ROLES } from '@/lib/finance/financial-authority';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';
import { rowsVisibleToGrant } from '@/lib/finance/principal-financial-authority';
import { externalInvoices } from '@/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Legacy creation is restricted to financial officers. Provider ingestion
// requires separate integration authorization and remains a release concern.
const { POST } = crudRoutes({
  table: externalInvoices,
  pk: 'id',
  tags: ['Finance'],
  orgScoped: true,
  readRole: 'secretary_treasurer',
  writeRole: 'secretary_treasurer',
  entitlement: 'financial_intelligence_suite',
});
export { POST };

export const GET = withApi({
  auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
  entitlement: 'financial_intelligence_suite',
  requireOrg: true,
  openapi: { tags: ['Finance'], summary: 'List invoices authorized by a live finance mandate' },
}, async ({ organizationId, userId }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Financial mandate required');
  return withRLSContext({ organizationId, userId }, async (tx) => {
    const grant = await requireLiveFinancialMandate(tx, {
      organizationId,
      userId,
      action: 'finance:view',
    });
    const rows = await tx.select({
      id: externalInvoices.id,
      invoiceNumber: externalInvoices.invoiceNumber,
      externalProvider: externalInvoices.externalProvider,
      customerName: externalInvoices.customerName,
      invoiceDate: externalInvoices.invoiceDate,
      dueDate: externalInvoices.dueDate,
      totalAmount: externalInvoices.totalAmount,
      balanceAmount: externalInvoices.balanceAmount,
      status: externalInvoices.status,
    }).from(externalInvoices)
      .where(rowsVisibleToGrant(grant, organizationId, externalInvoices.organizationId, externalInvoices.id))
      .orderBy(desc(externalInvoices.invoiceDate))
      .limit(100);
    return { data: rows, limit: 100 };
  });
});
