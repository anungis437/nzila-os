import { auth } from '@nzila/platform-auth/entra/server';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { Card } from '@nzila/ui';
import { resolveDemoContext } from '@/lib/demo-mode';
import { getGovernancePackSummary, listGovernancePersonaViews } from '@/modules/governance/service';

export default async function GovernancePage({
  searchParams,
}: {
  searchParams?: Promise<{ demo?: string; org?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const t = await getTranslations('abrDashboard.governance');
  const demo = resolveDemoContext((await searchParams) ?? undefined);
  const orgId = demo.organizationId;
  const summary = getGovernancePackSummary(orgId);
  const personaViews = listGovernancePersonaViews();

  return (
    <div className="space-y-6">
      {demo.enabled ? (
        <div className="rounded-2xl border border-electric/20 bg-electric/5 px-5 py-4 text-sm text-navy">
          {t('banner', { organization: demo.organizationName })}
        </div>
      ) : null}

      <div>
        <h2 className="font-poppins text-2xl font-bold text-navy">{t('title')}</h2>
        <p className="mt-1 text-slate-600">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card><div className="p-5"><p className="text-xs text-slate-500">{t('boardReadiness')}</p><p className="mt-2 font-poppins text-xl text-navy">{summary.boardReadiness}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">{t('criticalRisks')}</p><p className="mt-2 font-poppins text-xl text-navy">{summary.unresolvedCriticalRisks}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">{t('pendingActions')}</p><p className="mt-2 font-poppins text-xl text-navy">{summary.pendingExecutiveActions}</p></div></Card>
      </div>

      <p className="text-xs text-slate-500">{t('generatedAt', { value: new Date(summary.generatedAt).toLocaleString() })}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        {personaViews.map((view) => (
          <Card key={view.persona}>
            <div className="space-y-4 p-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{view.persona}</p>
                <h3 className="mt-1 font-poppins text-lg font-semibold text-navy">{view.headline}</h3>
              </div>
              <div className="space-y-3">
                {view.metrics.map((metric) => (
                  <div key={metric.label} className="rounded-lg border border-slate-100 p-3">
                    <p className="text-xs text-slate-500">{metric.label}</p>
                    <p className="font-poppins text-lg font-semibold text-navy">{metric.value}</p>
                    <p className="text-sm text-slate-600">{metric.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
