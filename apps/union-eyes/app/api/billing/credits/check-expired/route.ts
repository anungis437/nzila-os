/**
 * POST /api/billing/credits/check-expired
 *
 * Not implemented. This route cancelled an organization's expired trials after asking a placeholder whether the organization had a
 * payment method on file, and the placeholder always answered no. Any steward's page load therefore cancelled a trial that had a
 * payment method. There is no payment-method record to ask yet, so it answers 501 and changes nothing; trial expiry belongs to a
 * scheduled job that reads the payment-method record.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Billing'], summary: 'Expire past-due trials and credits (not implemented)' },
  },
  async () => {
    throw ApiError.notImplemented('Trial expiry is not implemented: there is no payment-method record to decide whether a trial converts or cancels.');
  },
);
