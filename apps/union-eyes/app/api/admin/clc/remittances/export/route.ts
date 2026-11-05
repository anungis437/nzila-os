/**
 * CLC / affiliate remittance export — NOT_IMPLEMENTED. This stub answered
 * 'accepted' and an empty list without exporting anything. Answers HTTP 501.
 */
import { retiredFinancialRoute } from '@/lib/finance/retired-financial-route';

export const dynamic = 'force-dynamic';

const handler = retiredFinancialRoute(
  '/api/admin/clc/remittances/export',
  'affiliate-remittance-export',
  'No qualified affiliate remittance export exists; nothing was exported.',
);
export const GET = handler;
export const POST = handler;
