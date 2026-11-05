/**
 * Compliance Administration
 * For the compliance manager: the audit trail recorded for the organization.
 *
 * Compliance scoring, regulatory status, risk assessment and downloadable compliance reports have no service behind them; the page says so
 * instead of showing fixed "Compliant" and "Passed" results.
 *
 * @role compliance_manager
 * @dashboard_path /dashboard/compliance-admin
 */

export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';
import { ComplianceAuditTrail } from '@/components/compliance/compliance-audit-trail';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ComplianceAdminPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'complianceAdminPage' });
  await requireUser();
  if (!(await hasMinRole('compliance_manager'))) redirect(`/${locale}/dashboard`);

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      <ComplianceAuditTrail />

      <section aria-labelledby="compliance-posture-heading" className="space-y-3">
        <h2 id="compliance-posture-heading" className="text-lg font-semibold">
          {t('postureTitle')}
        </h2>
        <CapabilityUnavailable locale={locale} capability="UE-COMPLIANCE-POSTURE-REPORTING" />
      </section>
    </div>
  );
}
