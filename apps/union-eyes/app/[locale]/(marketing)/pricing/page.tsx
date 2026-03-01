/**
 * Locale-aware Pricing page
 * Accessible at /{locale}/pricing
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { getTranslations } from 'next-intl/server';
import nextDynamic from 'next/dynamic';

const PricingPageClient = nextDynamic(
  () => import('@/app/(marketing)/pricing/pricing-page-client'),
  { ssr: true },
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.pricing' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

export default async function LocalePricingPage({
  params: _params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { userId } = await auth();
  const activePaymentProvider = process.env.ACTIVE_PAYMENT_PROVIDER ?? 'stripe';
  const whopRedirectUrl =
    process.env.NEXT_PUBLIC_WHOP_REDIRECT_URL ?? 'https://whop-boilerplate.vercel.app/dashboard';
  const whopMonthlyLink = process.env.NEXT_PUBLIC_WHOP_PAYMENT_LINK_MONTHLY ?? '#';
  const whopYearlyLink = process.env.NEXT_PUBLIC_WHOP_PAYMENT_LINK_YEARLY ?? '#';
  const whopMonthlyPlanId = process.env.WHOP_PLAN_ID_MONTHLY ?? '';
  const whopYearlyPlanId = process.env.WHOP_PLAN_ID_YEARLY ?? '';

  return (
    <PricingPageClient
      userId={userId}
      activePaymentProvider={activePaymentProvider}
      whopRedirectUrl={whopRedirectUrl}
      whopMonthlyLink={whopMonthlyLink}
      whopYearlyLink={whopYearlyLink}
      whopMonthlyPlanId={whopMonthlyPlanId}
      whopYearlyPlanId={whopYearlyPlanId}
      stripeMonthlyLink={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY ?? '#'}
      stripeYearlyLink={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_YEARLY ?? '#'}
      monthlyPrice="$30"
      yearlyPrice="$249"
    />
  );
}
