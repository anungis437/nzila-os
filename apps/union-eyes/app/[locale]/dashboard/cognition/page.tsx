/**
 * Cognition Dashboard — Phase 1
 *
 * Read-only operator surface for the @nzila/ue-cognition modules.
 * Engines are called server-side directly (org-scoped via Entra auth).
 * No mock data: every section hides itself when its inputs are empty.
 */

import { auth } from '@nzila/platform-auth/entra/server';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import {
  buildExecutiveSummary,
  computeKpiSnapshot,
  computeWorkloadFairness,
  listEngagementSnapshots,
  type RiskTier,
} from '@nzila/ue-cognition';
import { getTranslations } from 'next-intl/server';
import {
  scoreOrgRecentCases,
  scoreStewardWorkloads,
  stewardSubject,
} from '@/lib/cognition/ue-adapter';
import { RuntimeHydrationFooter } from '@/components/runtime-hydration';
import { CONTINUITY_COGNITION_VERSION } from '@nzila/institutional-governance-graph';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string }>;
};

const TIER_COLOR: Record<RiskTier, string> = {
  low: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cognitionPage.metadata' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function CognitionPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cognitionPage' });
  const getRiskTierLabel = (tier: RiskTier) => {
    switch (tier) {
      case 'low':
        return t('riskTier.low');
      case 'medium':
        return t('riskTier.medium');
      case 'high':
        return t('riskTier.high');
      case 'critical':
        return t('riskTier.critical');
      default:
        return tier;
    }
  };
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'overloaded':
        return t('status.overloaded');
      case 'busy':
        return t('status.busy');
      case 'balanced':
        return t('status.balanced');
      case 'idle':
        return t('status.idle');
      default:
        return t('status.unknown');
    }
  };
  const getEngagementTierLabel = (tier: string) => {
    switch (tier) {
      case 'engaged':
        return t('engagementTier.engaged');
      case 'at_risk':
        return t('engagementTier.atRisk');
      case 'disengaged':
        return t('engagementTier.disengaged');
      case 'lost':
        return t('engagementTier.lost');
      default:
        return tier;
    }
  };
  const session = await auth();
  if (!session?.userId) {
    return <div className="p-8 text-sm">{t('states.signInRequired')}</div>;
  }
  const orgId = await getOrganizationIdForUser(session.userId);
  if (!orgId) {
    return <div className="p-8 text-sm">{t('states.noOrganizationContext')}</div>;
  }
  const subject = { tenantId: 'union-eyes', orgId };

  // Fresh computes (Phase-1 — small data volumes; Phase-2 will use cron).
  const recentCases = await scoreOrgRecentCases(orgId, 30);
  const stewards = await scoreStewardWorkloads(orgId);
  const fairness = stewards.length > 0
    ? computeWorkloadFairness(stewardSubject(orgId, 'org'), stewards)
    : null;
  const summary = buildExecutiveSummary(subject);
  const engagement = listEngagementSnapshots()
    .filter((s) => s.subject.orgId === orgId)
    .sort((a, b) => b.disengagementProbability - a.disengagementProbability)
    .slice(0, 25);

  const kpis = computeKpiSnapshot({
    subject,
    windowDays: 30,
    baseline: { avgCycleTimeDays: null, utilizationFairness: null, disengagedMemberCount: null },
    observedCycleTimeDays: null,
    observedCasesSavedFromSlaBreach: null,
    observedAcceptedReassignments: null,
    stewardCount: stewards.length,
  });

  const tierCounts: Record<RiskTier, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const c of recentCases) tierCounts[c.riskTier] += 1;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('header.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('header.description')}
        </p>
        <p className="mt-2 text-xs text-amber-700">
          Assistive reasoning · Human-reviewed · Review-required — governance
          support tooling. Outputs on this surface inform human decision-making
          and never act autonomously.
        </p>
      </header>

      {/* KPI Tiles */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('kpis.title')}</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiTile label={t('kpis.tiles.backlogRiskCurrent')} value={kpis.backlogRiskCurrent} format="prob" noSourceDataText={t('kpis.noSourceData')} />
          <KpiTile label={t('kpis.tiles.stewardFairness')} value={kpis.utilizationFairnessCurrent} format="prob" noSourceDataText={t('kpis.noSourceData')} />
          <KpiTile label={t('kpis.tiles.disengagedMembers')} value={kpis.disengagedMembersEnd} format="int" noSourceDataText={t('kpis.noSourceData')} />
          <KpiTile label={t('kpis.tiles.avgCycleTimeDays')} value={kpis.avgCycleTimeDays} format="num" noSourceDataText={t('kpis.noSourceData')} />
          <KpiTile label={t('kpis.tiles.adminHoursSaved')} value={kpis.estimatedAdminHoursSaved} format="num" noSourceDataText={t('kpis.noSourceData')} />
          <KpiTile label={t('kpis.tiles.estimatedRoiCad')} value={kpis.estimatedRoiCad} format="cad" noSourceDataText={t('kpis.noSourceData')} />
        </div>
        <details className="mt-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer">{t('kpis.assumptionsSummary')}</summary>
          <ul className="mt-2 list-disc pl-5">
            {kpis.assumptions.map((a) => (
              <li key={a.key}>
                <strong>{a.key}</strong>: {a.value} — {a.note}
              </li>
            ))}
          </ul>
        </details>
      </section>

      {/* Risk funnel */}
      {recentCases.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('riskFunnel.title')}</h2>
          <div className="grid grid-cols-4 gap-3">
            {(Object.keys(tierCounts) as RiskTier[]).map((tier) => (
              <div key={tier} className={`rounded-md p-4 ${TIER_COLOR[tier]}`}>
                <div className="text-xs uppercase">{getRiskTierLabel(tier)}</div>
                <div className="text-2xl font-bold">{tierCounts[tier]}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Steward heat-map */}
      {stewards.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('stewardWorkload.title')}</h2>
          {fairness && (
            <p className="mb-2 text-sm text-muted-foreground">
              {t('stewardWorkload.teamFairness', {
                score: fairness.fairnessScore.toFixed(2),
                utilization: (fairness.meanUtilization * 100).toFixed(0),
              })}
            </p>
          )}
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th>{t('stewardWorkload.columns.steward')}</th>
                <th>{t('stewardWorkload.columns.status')}</th>
                <th>{t('stewardWorkload.columns.utilization')}</th>
                <th>{t('stewardWorkload.columns.atRiskCases')}</th>
                <th>{t('stewardWorkload.columns.slaRisk')}</th>
              </tr>
            </thead>
            <tbody>
              {stewards.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="py-2">{s.stewardId.slice(0, 8)}</td>
                  <td>
                    <StatusPill
                      status={s.status}
                      label={getStatusLabel(s.status)}
                    />
                  </td>
                  <td>{(s.utilizationRatio * 100).toFixed(0)}%</td>
                  <td>{s.atRiskCaseCount}</td>
                  <td>{(s.slaRiskScore * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Disengaged members queue */}
      {engagement.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('memberEngagement.title')}</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th>{t('memberEngagement.columns.member')}</th>
                <th>{t('memberEngagement.columns.tier')}</th>
                <th>{t('memberEngagement.columns.disengagementRisk')}</th>
                <th>{t('memberEngagement.columns.recommendedChannel')}</th>
                <th>{t('memberEngagement.columns.withinHours')}</th>
              </tr>
            </thead>
            <tbody>
              {engagement.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="py-2">{m.memberId.slice(0, 8)}</td>
                  <td>{getEngagementTierLabel(m.tier)}</td>
                  <td>{(m.disengagementProbability * 100).toFixed(0)}%</td>
                  <td>{m.recommendedChannel}</td>
                  <td>{m.recommendedTimingHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Executive interventions */}
      {summary.recommendedInterventions.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('executiveInterventions.title')}</h2>
          <ul className="space-y-2">
            {summary.recommendedInterventions.map((i, idx) => (
              <li key={idx} className="rounded border p-3 text-sm">
                <span className="mr-2 rounded bg-slate-100 px-2 py-0.5 text-xs uppercase">
                  {getRiskTierLabel(i.priority)}
                </span>
                {i.summary}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        {t('footer.models', {
          modelVersion: kpis.modelVersion,
          org: orgId.slice(0, 8),
          generatedAt: new Date().toISOString(),
        })}
      </footer>
      <RuntimeHydrationFooter
        surface="Cognition Dashboard"
        provenance={{
          sourceAdapter: '@nzila/ue-cognition + institutional-governance-graph',
          substrateVersion: CONTINUITY_COGNITION_VERSION,
          contractVersion: kpis.modelVersion,
        }}
        continuity={{}}
        cognition={{}}
        explainability={{
          visibilityRationale:
            'Substrate-presence footer for the Wave 3 continuity cognition layer. The engine tiles above are KPI projections; the panels below disclose the underlying continuity, chronology, and topology substrate references so reviewers can audit the source of every number without invoking any predictive surface.',
          reviewPosture: 'assistive · human-reviewed · review-required',
        }}
      />
    </div>
  );
}

function KpiTile({ label, value, format, noSourceDataText }: { label: string; value: number | null; format: 'prob' | 'int' | 'num' | 'cad'; noSourceDataText: string }) {
  const isNull = value === null || Number.isNaN(value);
  let text = '—';
  if (!isNull) {
    if (format === 'prob') text = `${(value! * 100).toFixed(0)}%`;
    else if (format === 'int') text = String(Math.round(value!));
    else if (format === 'num') text = value!.toFixed(1);
    else text = `$${value!.toLocaleString()}`;
  }
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{text}</div>
      {isNull && <div className="mt-1 text-xs text-muted-foreground">{noSourceDataText}</div>}
    </div>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const colour =
    status === 'overloaded' ? 'bg-red-100 text-red-800' :
    status === 'busy' ? 'bg-amber-100 text-amber-800' :
    status === 'balanced' ? 'bg-emerald-100 text-emerald-800' :
    status === 'idle' ? 'bg-slate-100 text-slate-700' :
    'bg-slate-50 text-slate-500';
  return <span className={`rounded px-2 py-0.5 text-xs ${colour}`}>{label}</span>;
}
