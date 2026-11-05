/**
 * Union budgets — NOT_IMPLEMENTED. The budgets table was never created and
 * Nzila billing reports are not a union budget. Answers HTTP 501.
 */
import { retiredFinancialRoute } from '@/lib/finance/retired-financial-route';

export const dynamic = 'force-dynamic';

const handler = retiredFinancialRoute('/api/financial/budgets', 'union-budgets');

export const GET = handler;
export const POST = handler;
