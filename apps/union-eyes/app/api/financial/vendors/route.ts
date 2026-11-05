/**
 * Union vendors — NOT_IMPLEMENTED. The vendors table was never created and
 * Nzila billing reports are not a union vendor record. Answers HTTP 501.
 */
import { retiredFinancialRoute } from '@/lib/finance/retired-financial-route';

export const dynamic = 'force-dynamic';

const handler = retiredFinancialRoute('/api/financial/vendors', 'union-vendors');

export const GET = handler;
export const POST = handler;
