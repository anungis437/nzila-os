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
import {
  scoreOrgRecentCases,
  scoreStewardWorkloads,
  stewardSubject,
} from '@/lib/cognition/ue-adapter';

export const dynamic = 'force-dynamic';

const TIER_COLOR: Record<RiskTier, string> = {
  low: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export default async function CognitionPage() {
  const session = await auth();
  if (!session?.userId) {
    return <div className="p-8 text-sm">Sign-in required.</div>;
  }
  const orgId = await getOrganizationIdForUser(session.userId);
  if (!orgId) {
    return <div className="p-8 text-sm">No organization context.</div>;
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
        <h1 className="text-2xl font-semibold">Cognition Operations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Predictive operational intelligence across grievances, stewards, and members.
          All recommendations are advisory — human override is required for every action.
        </p>
      </header>

      {/* KPI Tiles */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Operational KPIs (last 30 days)</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiTile label="Backlog risk score (now)" value={kpis.backlogRiskCurrent} format="prob" />
          <KpiTile label="Steward fairness" value={kpis.utilizationFairnessCurrent} format="prob" />
          <KpiTile label="Disengaged member count" value={kpis.disengagedMembersEnd} format="int" />
          <KpiTile label="Avg cycle time (days)" value={kpis.avgCycleTimeDays} format="num" />
          <KpiTile label="Admin hours saved" value={kpis.estimatedAdminHoursSaved} format="num" />
          <KpiTile label="Estimated ROI (CAD)" value={kpis.estimatedRoiCad} format="cad" />
        </div>
        <details className="mt-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Assumptions &amp; model versions</summary>
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
          <h2 className="mb-3 text-lg font-semibold">Grievance Risk Funnel</h2>
          <div className="grid grid-cols-4 gap-3">
            {(Object.keys(tierCounts) as RiskTier[]).map((t) => (
              <div key={t} className={`rounded-md p-4 ${TIER_COLOR[t]}`}>
                <div className="text-xs uppercase">{t}</div>
                <div className="text-2xl font-bold">{tierCounts[t]}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Steward heat-map */}
      {stewards.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Steward Workload</h2>
          {fairness && (
            <p className="mb-2 text-sm text-muted-foreground">
              Team fairness score: <strong>{fairness.fairnessScore.toFixed(2)}</strong>
              &nbsp;(mean utilisation {(fairness.meanUtilization * 100).toFixed(0)}%)
            </p>
          )}
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th>Steward</th><th>Status</th><th>Utilisation</th><th>At-risk cases</th><th>SLA risk</th></tr>
            </thead>
            <tbody>
              {stewards.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="py-2">{s.stewardId.slice(0, 8)}</td>
                  <td><StatusPill status={s.status} /></td>
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
          <h2 className="mb-3 text-lg font-semibold">Member Engagement Queue</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th>Member</th><th>Tier</th><th>Disengagement risk</th><th>Recommended channel</th><th>Within (h)</th></tr>
            </thead>
            <tbody>
              {engagement.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="py-2">{m.memberId.slice(0, 8)}</td>
                  <td>{m.tier}</td>
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
          <h2 className="mb-3 text-lg font-semibold">Executive Interventions</h2>
          <ul className="space-y-2">
            {summary.recommendedInterventions.map((i, idx) => (
              <li key={idx} className="rounded border p-3 text-sm">
                <span className="mr-2 rounded bg-slate-100 px-2 py-0.5 text-xs uppercase">{i.priority}</span>
                {i.summary}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        Models: case-risk {kpis.modelVersion} · org {orgId.slice(0, 8)} · generated {new Date().toISOString()}
      </footer>
    </div>
  );
}

function KpiTile({ label, value, format }: { label: string; value: number | null; format: 'prob' | 'int' | 'num' | 'cad' }) {
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
      {isNull && <div className="mt-1 text-xs text-muted-foreground">No source data yet</div>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colour =
    status === 'overloaded' ? 'bg-red-100 text-red-800' :
    status === 'busy' ? 'bg-amber-100 text-amber-800' :
    status === 'balanced' ? 'bg-emerald-100 text-emerald-800' :
    status === 'idle' ? 'bg-slate-100 text-slate-700' :
    'bg-slate-50 text-slate-500';
  return <span className={`rounded px-2 py-0.5 text-xs ${colour}`}>{status}</span>;
}
