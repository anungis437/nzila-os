/**
 * Non-locale Pricing page — redirects to locale-prefixed route.
 * Marketing pricing content lives at /en-CA/pricing.
 */
import { redirect } from 'next/navigation';

export default function PricingPage() {
  redirect('/en-CA/pricing');
}

