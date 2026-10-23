/**
 * Strike eligibility — NOT_IMPLEMENTED. This route was bound to votingSessions.
 * No qualified strike-fund eligibility model exists. Answers HTTP 501.
 */
import { retiredFinancialRoute } from '@/lib/finance/retired-financial-route';

export const dynamic = 'force-dynamic';

const handler = retiredFinancialRoute(
  '/api/strike/eligibility',
  'strike-eligibility',
  'No qualified strike eligibility record store exists. This route no longer reads or writes voting records.',
);
export const GET = handler;
export const POST = handler;
