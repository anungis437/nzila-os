/**
 * Strike disbursements — NOT_IMPLEMENTED. This route was bound to
 * votingSessions. No qualified strike-fund model exists. Answers HTTP 501.
 */
import { retiredFinancialRoute } from '@/lib/finance/retired-financial-route';

export const dynamic = 'force-dynamic';

const handler = retiredFinancialRoute(
  '/api/strike/disbursements',
  'strike-disbursements',
  'No qualified strike-fund record store exists. This route no longer reads or writes voting records.',
);
export const GET = handler;
export const POST = handler;
