/**
 * Strike funds — NOT_IMPLEMENTED. This route was bound to votingSessions, so
 * voting records were served and mutated as fund balances. No qualified
 * strike-fund model exists. Answers HTTP 501.
 */
import { retiredFinancialRoute } from '@/lib/finance/retired-financial-route';

export const dynamic = 'force-dynamic';

const handler = retiredFinancialRoute(
  '/api/strike/funds',
  'strike-funds',
  'No qualified strike-fund record store exists. This route no longer reads or writes voting records.',
);
export const GET = handler;
export const POST = handler;
