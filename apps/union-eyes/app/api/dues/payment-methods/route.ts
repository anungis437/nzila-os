/**
 * GET /api/dues/payment-methods — List saved payment methods for the user
 */

import { withApi, ApiError } from '@/lib/api/framework';
import { stripe } from '@/lib/stripe';
import { getProfileByUserId } from '@/db/queries/profiles-queries';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    openapi: {
      tags: ['Dues'],
      summary: 'List saved payment methods for the authenticated user',
    },
  },
  async ({ userId }) => {
    if (!userId) throw ApiError.badRequest('User context required');

    const profile = await getProfileByUserId(userId);
    if (!profile?.stripeCustomerId) {
      return [];
    }

    const methods = await stripe.paymentMethods.list({
      customer: profile.stripeCustomerId,
      type: 'card',
    });

    const customer = await stripe.customers.retrieve(profile.stripeCustomerId);
    const defaultMethodId =
      typeof customer !== 'string' && !customer.deleted
        ? (customer.invoice_settings?.default_payment_method as string | null)
        : null;

    return methods.data.map((pm) => ({
      id: pm.id,
      type: 'card' as const,
      last4: pm.card?.last4 ?? '',
      brand: pm.card?.brand ?? undefined,
      expiryMonth: pm.card?.exp_month ?? undefined,
      expiryYear: pm.card?.exp_year ?? undefined,
      isDefault: pm.id === defaultMethodId,
    }));
  },
);
