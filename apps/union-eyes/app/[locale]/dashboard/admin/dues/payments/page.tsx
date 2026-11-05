'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';

export const dynamic = 'force-dynamic';

/**
 * Admin payments list.
 *
 * The route that was meant to feed it, /api/admin/dues/payments, answers HTTP 501: it returned the member roster under
 * that name and performed no payment operation, and the native dues engine is not part of this release. The page says
 * so instead of showing an empty list.
 */
export default function AdminPaymentsList() {
  const t = useTranslations('adminPaymentsPage');
  const locale = useLocale();

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('pageTitle')}</h1>
      <CapabilityUnavailable locale={locale} capability="UE-FIN-DUES-ADMIN-PAYMENTS" />
    </div>
  );
}
