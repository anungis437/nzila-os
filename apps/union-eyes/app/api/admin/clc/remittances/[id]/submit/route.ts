/**
 * CLC / affiliate remittance submission — NOT_IMPLEMENTED. This stub answered
 * 'accepted' without submitting anything and was named after organizationMembers.
 * Answers HTTP 501.
 */
import { retiredFinancialRoute } from '@/lib/finance/retired-financial-route';

export const dynamic = 'force-dynamic';

const handler = retiredFinancialRoute(
  '/api/admin/clc/remittances/:id/submit',
  'affiliate-remittance-submission',
  'No qualified affiliate remittance submission workflow exists; nothing was submitted.',
);
export const GET = handler;
export const POST = handler;

