/**
 * CLC / affiliate remittance item — NOT_IMPLEMENTED. This route was bound to
 * organizationMembers (including PATCH/DELETE of membership rows). Answers
 * HTTP 501.
 */
import { retiredFinancialRoute } from '@/lib/finance/retired-financial-route';

export const dynamic = 'force-dynamic';

const handler = retiredFinancialRoute(
  '/api/admin/clc/remittances/:id',
  'affiliate-remittances',
  'No qualified affiliate (per-capita) remittance record store is bound to this route. It no longer reads or writes membership records.',
);
export const GET = handler;
export const PATCH = handler;
export const DELETE = handler;
