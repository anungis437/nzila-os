export const dynamic = 'force-dynamic';

import { auth } from "@clerk/nextjs/server";
import nextDynamic from "next/dynamic";

const PricingPageClient = nextDynamic(() => import("./pricing-page-client"), { ssr: true });

export default async function PricingPage() {
  const { userId } = await auth();
  
  // Provider selection happens server-side through environment variables
  // This is never exposed to the client
  const activePaymentProvider = process.env.ACTIVE_PAYMENT_PROVIDER || "stripe";

  // Get the redirect URL for Whop (fallback to /dashboard if not set)
  const whopRedirectUrl = process.env.NEXT_PUBLIC_WHOP_REDIRECT_URL || 'https://whop-boilerplate.vercel.app/dashboard';
  
  // Prepare base Whop payment links - we keep these for direct links option
  const whopMonthlyLink = process.env.NEXT_PUBLIC_WHOP_PAYMENT_LINK_MONTHLY || '#';
  const whopYearlyLink = process.env.NEXT_PUBLIC_WHOP_PAYMENT_LINK_YEARLY || '#';

  // Get plan IDs
  const whopMonthlyPlanId = process.env.WHOP_PLAN_ID_MONTHLY || '';
  const whopYearlyPlanId = process.env.WHOP_PLAN_ID_YEARLY || '';

  // Pricing values (updated to match design)
  const monthlyPrice = "$30";
  const yearlyPrice = "$249";

  return (
    <PricingPageClient 
      userId={userId}
      activePaymentProvider={activePaymentProvider}
      whopRedirectUrl={whopRedirectUrl}
      whopMonthlyLink={whopMonthlyLink}
      whopYearlyLink={whopYearlyLink}
      whopMonthlyPlanId={whopMonthlyPlanId}
      whopYearlyPlanId={whopYearlyPlanId}
      stripeMonthlyLink={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY || "#"}
      stripeYearlyLink={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_YEARLY || "#"}
      monthlyPrice={monthlyPrice}
      yearlyPrice={yearlyPrice}
    />
  );
}

