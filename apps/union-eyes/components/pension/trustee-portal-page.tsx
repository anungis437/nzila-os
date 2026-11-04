'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';

/**
 * Pension trustee portal.
 *
 * It cannot say who a trustee is. Trustee appointment and administration need an independently verified authority that
 * does not exist yet (every write under /api/pension/trustees answers HTTP 501), and the trustee list is all active
 * trustees of the organization, not the signed-in user's own appointment. The portal that treated "some trustee exists"
 * as "you are a trustee", and showed plan, meeting and trustee figures under field names those tables do not have, was
 * removed. The page says so instead.
 */
export default function TrusteePortalPage() {
  const t = useTranslations('pensionTrusteePortalPage');
  const locale = useLocale();

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <CapabilityUnavailable locale={locale} capability="UE-FIN-PENSION-TRUSTEE-ADMIN" />
    </div>
  );
}
