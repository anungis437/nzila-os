/**
 * CLC / affiliate remittances — NOT_IMPLEMENTED. This route was bound to
 * organizationMembers, exposing and mutating membership records under a
 * remittance name. No qualified affiliate-remittance model exists. Answers
 * HTTP 501.
 */
import { retiredFinancialRoute } from '@/lib/finance/retired-financial-route';

export const dynamic = 'force-dynamic';

const handler = retiredFinancialRoute(
  '/api/admin/clc/remittances',
  'affiliate-remittances',
  'No qualified affiliate (per-capita) remittance record store is bound to this route. It no longer reads or writes membership records.',
);
export const GET = handler;
export const POST = handler;
