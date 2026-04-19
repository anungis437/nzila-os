import { auth } from '@nzila/platform-auth/entra/server';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Card } from '@nzila/ui';
import { resolveDataMode } from '@/lib/data-mode';
import {
  getExecutiveInsightWidgets,
  getIntelligenceFacets,
  listImportJobs,
  listIntelligenceListing,
  listManualReviewQueue,
  listRiskSignals,
  listSourceRegistry,
} from '@/modules/intelligence/service';
import type { IntelligenceReviewStatus } from '@/modules/intelligence/types';

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams?: Promise<{
    demo?: string;
    mode?: string;
    search?: string;
    reviewStatus?: string;
    jurisdiction?: string;
    year?: string;
    sector?: string;
    decisionBody?: string;
    issueType?: string;
    protectedGround?: string;
    remedyType?: string;
    awardRange?: string;
    employerType?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const t = await getTranslations('abrDashboard.intelligence');
  const params = (await searchParams) ?? {};
  const mode = resolveDataMode({ demo: params.demo, mode: params.mode });
  const orgId = process.env.ABR_DEMO_ORG_ID ?? 'metro-university';
  const reviewStatus = ['pending', 'approved', 'flagged', 'needs_update'].includes(params.reviewStatus ?? '')
    ? (params.reviewStatus as IntelligenceReviewStatus)
    : undefined;
  const filters = {
    ...params,
    reviewStatus,
    dataMode: mode.mode,
    page: params.page ? Number(params.page) : 1,
    pageSize: params.pageSize ? Number(params.pageSize) : 9,
  };

  const [listing, widgets, facets, sources, jobs, reviewQueue] = await Promise.all([
    listIntelligenceListing(filters),
    getExecutiveInsightWidgets(mode.mode),
    getIntelligenceFacets(mode.mode),
    listSourceRegistry(mode.mode),
    listImportJobs(mode.mode),
    listManualReviewQueue(mode.mode),
  ]);
  const signals = listRiskSignals(orgId, mode.mode);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-electric/20 bg-electric/5 px-5 py-4 text-sm text-navy">
        {t('modeBanner', { mode: mode.label, sourceCount: sources.length, reviewQueue: reviewQueue.length })}
      </div>

      <div>
        <h2 className="font-poppins text-2xl font-bold text-navy">{t('title')}</h2>
        <p className="mt-1 text-slate-600">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {widgets.risingIssueCategories.map((item) => (
          <Card key={item.label}>
            <div className="space-y-2 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">{t('risingIssue')}</p>
              <p className="font-poppins text-lg font-semibold text-navy">{item.label}</p>
              <p className="text-sm text-slate-600">{t('increase', { value: item.deltaPct })}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="space-y-4 p-6">
          <h3 className="font-poppins text-lg font-semibold text-navy">{t('filtersTitle')}</h3>
          <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-3 lg:grid-cols-5">
            <div>{t('jurisdictions')}: {facets.jurisdictions.join(', ')}</div>
            <div>{t('years')}: {facets.years.join(', ')}</div>
            <div>{t('sectors')}: {facets.sectors.join(', ')}</div>
            <div>{t('issueTypes')}: {facets.issueTypes.join(', ')}</div>
            <div>{t('remedies')}: {facets.remedyTypes.join(', ')}</div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {signals.map((signal) => (
          <Card key={signal.id}>
            <div className="space-y-3 p-6">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                <span>{signal.category.replace('_', ' ')}</span>
                <span>{t('confidence')}: {signal.confidenceBand}</span>
              </div>
              <p className="text-sm text-slate-700">{signal.signal}</p>
              <p className="text-xs text-slate-500">{t('observedAt', { value: new Date(signal.observedAt).toLocaleString() })}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {listing.items.map((item) => (
          <Card key={item.id}>
            <div className="space-y-3 p-6">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                <span>{item.decisionBody}</span>
                <span>{item.sourceStatus}</span>
              </div>
              <h3 className="font-poppins text-lg font-semibold text-navy">{item.title}</h3>
              <p className="text-sm text-slate-700">{item.conciseSummary}</p>
              <p className="text-xs text-slate-500">{t('sourceLine', { source: item.source, freshness: item.freshnessDate })}</p>
              <Link href={`./intelligence/${item.id}`} className="text-sm font-semibold text-electric">
                {t('openCase')}
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <p className="text-sm text-slate-500">{t('pagination', { page: listing.page, total: listing.total })}</p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="space-y-3 p-6">
            <h3 className="font-poppins text-lg font-semibold text-navy">{t('sourceRegistry')}</h3>
            {sources.map((source) => (
              <p key={source.id} className="text-sm text-slate-700">{source.sourceName} • {source.stale ? t('stale') : t('fresh')}</p>
            ))}
          </div>
        </Card>
        <Card>
          <div className="space-y-3 p-6">
            <h3 className="font-poppins text-lg font-semibold text-navy">{t('importJobs')}</h3>
            {jobs.map((job) => (
              <p key={job.id} className="text-sm text-slate-700">{job.sourceId} • {job.parseStatus} • {job.confidenceLabel}</p>
            ))}
          </div>
        </Card>
        <Card>
          <div className="space-y-3 p-6">
            <h3 className="font-poppins text-lg font-semibold text-navy">{t('reviewQueue')}</h3>
            {reviewQueue.map((item) => (
              <p key={item.id} className="text-sm text-slate-700">{item.caseId} • {item.reason}</p>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
