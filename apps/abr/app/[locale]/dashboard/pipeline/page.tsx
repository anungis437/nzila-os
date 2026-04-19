import { auth } from '@nzila/platform-auth/entra/server';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { Card } from '@nzila/ui';
import { getPipelineSummary, listPipelineAccounts } from '@/modules/pipeline/service';

export default async function PipelinePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const t = await getTranslations('abrDashboard.pipeline');
  const summary = await getPipelineSummary();
  const accounts = await listPipelineAccounts();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-navy">{t('title')}</h2>
        <p className="mt-1 text-slate-600">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><div className="p-5"><p className="text-xs text-slate-500">{t('stats.totalAccounts')}</p><p className="mt-2 font-poppins text-xl text-navy">{summary.totalAccounts}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">{t('stats.activeDemos')}</p><p className="mt-2 font-poppins text-xl text-navy">{summary.activeDemos}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">{t('stats.procurementActive')}</p><p className="mt-2 font-poppins text-xl text-navy">{summary.procurementActive}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">{t('stats.pipelineValue')}</p><p className="mt-2 font-poppins text-xl text-navy">{summary.projectedPipelineValue}</p></div></Card>
      </div>

      <Card>
        <div className="space-y-4 p-6">
          <h3 className="font-poppins text-lg font-semibold text-navy">{t('accountListTitle')}</h3>
          {accounts.map((account) => (
            <div key={account.id} className="rounded-xl border border-slate-100 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h4 className="font-poppins text-base font-semibold text-navy">{account.organizationName}</h4>
                  <p className="text-sm text-slate-600">{account.nextAction}</p>
                </div>
                <div className="text-sm text-slate-500">
                  {t('stageLabel')}: {account.stage}
                </div>
              </div>
              <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-4">
                <div>{t('ownerLabel')}: {account.owner}</div>
                <div>{t('championLabel')}: {account.buyerChampion}</div>
                <div>{t('dueLabel')}: {new Date(account.nextActionDueAt).toLocaleDateString()}</div>
                <div>{t('statusLabel')}: {account.crmStatus}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
