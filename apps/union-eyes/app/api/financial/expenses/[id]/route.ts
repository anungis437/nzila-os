/**
 * Union expenses — NOT_IMPLEMENTED. The expenses table was never created and
 * Nzila billing reports are not a union expense record. Answers HTTP 501.
 */
import { retiredFinancialRoute } from '@/lib/finance/retired-financial-route';

export const dynamic = 'force-dynamic';

const handler = retiredFinancialRoute('/api/financial/expenses/:id', 'union-expenses');

export const GET = handler;
export const PATCH = handler;
export const DELETE = handler;
