'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';

export const dynamic = 'force-dynamic';

/**
 * Admin payment detail.
 *
 * The route that was meant to feed it, /api/admin/dues/payments/:id, answers HTTP 501: it returned member roster rows
 * under that name and performed no payment operation, and the native dues engine is not part of this release. The page
 * says so instead of showing a payment that is not there.
 */
export default function PaymentDetailPage() {
  const t = useTranslations('adminDuesPaymentDetailPage');
  const locale = useLocale();

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('title')}</h1>
      <CapabilityUnavailable locale={locale} capability="UE-FIN-DUES-ADMIN-PAYMENTS" />
    </div>
  );
}
