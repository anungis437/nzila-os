/**
 * Strike picket lines — NOT_IMPLEMENTED. This route was bound to
 * votingSessions. No qualified picket-line model exists. Answers HTTP 501.
 */
import { retiredFinancialRoute } from '@/lib/finance/retired-financial-route';

export const dynamic = 'force-dynamic';

const handler = retiredFinancialRoute(
  '/api/strike/picket-lines',
  'strike-picket-lines',
  'No qualified picket-line record store exists. This route no longer reads or writes voting records.',
);
export const GET = handler;
export const POST = handler;
