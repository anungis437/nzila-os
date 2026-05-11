'use client';

/**
 * Continuity Intelligence Cockpit
 *
 * Executive-grade organizational continuity oversight dashboard.
 *
 * Sections:
 *   1. Organizational Continuity Score + trend
 *   2. Operational Fragility Overview (risk panel)
 *   3. Expertise Concentration Map
 *   4. Knowledge Transfer Velocity (timeline)
 *   5. Succession Fragility Insights
 *   6. Governance Dependency Alerts
 *   7. Topic Graph (knowledge relationships)
 *
 * Design: calm institutional intelligence. Not surveillance software.
 * Framing: organizational continuity, not individual evaluation.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ContinuityHealthPanel } from './continuity-health-panel';
import { GovernanceDriftTimelineContainer } from './governance-timeline/governance-drift-timeline';
import { ExpertiseMap } from './expertise-map/expertise-map';
import { ContinuityHeatmapContainer } from './heatmaps/continuity-heatmap';
import { TopicGraphContainer } from './topic-graph/topic-graph-viz';

interface SuccessionFragilityReport {
  transitionReadinessScore: number;
  roleSuccessionStatus: Array<{
    role: string;
    interviewCount: number;
    successorReadiness: 'none' | 'minimal' | 'partial' | 'adequate';
    averageContinuityRiskScore: number;
  }>;
  criticalOperationalGaps: string[];
  documentationPriorities: string[];
  continuityRecommendations: string[];
  executiveSummary: string;
}

const READINESS_STYLE = {
  none: { bar: 'bg-red-400', text: 'text-red-600' },
  minimal: { bar: 'bg-orange-400', text: 'text-orange-600' },
  partial: { bar: 'bg-yellow-400', text: 'text-yellow-600' },
  adequate: { bar: 'bg-green-400', text: 'text-green-600' },
};

const ROLE_LABELS: Record<string, string> = {
  member: 'Member',
  steward: 'Steward',
  chief_steward: 'Chief Steward',
  officer: 'Officer',
  admin: 'Admin',
};

function ReadinessScore({ score }: { score: number }) {
  const color =
    score >= 75 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600';
  const label =
    score >= 75 ? 'Transition Ready' : score >= 50 ? 'Partial Readiness' : 'Fragile';
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke={score >= 75 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444'}
            strokeWidth="3"
            strokeDasharray={`${score} ${100 - score}`}
            strokeLinecap="round"
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums ${color}`}
        >
          {score}
        </span>
      </div>
      <div>
        <p className={`font-semibold ${color}`}>{label}</p>
        <p className="text-xs text-muted-foreground">Transition readiness</p>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
  defaultOpen = true,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 p-5 text-left hover:bg-muted/20 transition-colors rounded-t-lg"
      >
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <span className="text-muted-foreground text-sm flex-shrink-0 mt-0.5">
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && <div className="px-5 pb-5 pt-0 border-t">{children}</div>}
    </section>
  );
}

function SuccessionPanel() {
  const [report, setReport] = useState<SuccessionFragilityReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/exit-interviews/succession', { cache: 'no-store' });
        if (!res.ok) { setLoading(false); return; }
        const payload = await res.json() as { data: SuccessionFragilityReport };
        setReport(payload.data);
      } catch {
        // silent — not all users have officer access
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) return <div className="h-32 bg-muted/30 rounded-lg animate-pulse mt-4" />;
  if (!report) return null;

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-4">
        <ReadinessScore score={report.transitionReadinessScore} />
        {report.executiveSummary && (
          <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/20 pl-3">
            {report.executiveSummary}
          </p>
        )}
      </div>

      {/* Role succession grid */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {report.roleSuccessionStatus.map((role) => {
          const style = READINESS_STYLE[role.successorReadiness];
          return (
            <div key={role.role} className="rounded-md border bg-card p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{ROLE_LABELS[role.role] ?? role.role}</span>
                <span className={`text-xs font-medium ${style.text}`}>
                  {role.successorReadiness.replace('_', ' ')}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${style.bar}`}
                  style={{
                    width: `${
                      role.successorReadiness === 'adequate' ? 100 :
                      role.successorReadiness === 'partial' ? 60 :
                      role.successorReadiness === 'minimal' ? 25 : 0
                    }%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {role.interviewCount} interview{role.interviewCount !== 1 ? 's' : ''}
                {role.averageContinuityRiskScore > 0 &&
                  ` · avg risk ${role.averageContinuityRiskScore}/100`}
              </p>
            </div>
          );
        })}
      </div>

      {/* Priorities */}
      {report.documentationPriorities.length > 0 && (
        <div className="rounded-md border bg-blue-50 border-blue-200 p-3">
          <p className="text-xs font-semibold text-blue-800 mb-2">Documentation Priorities</p>
          <ul className="space-y-1">
            {report.documentationPriorities.slice(0, 4).map((p, i) => (
              <li key={i} className="text-xs text-blue-700 flex gap-2">
                <span className="text-blue-400 flex-shrink-0">{i + 1}.</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ContinuityIntelligenceCockpit() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Continuity Intelligence</h1>
          <p className="text-muted-foreground mt-1">
            Organizational knowledge fragility, succession readiness, and governance oversight.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="../knowledge-transfer"
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            ← Knowledge Transfer
          </Link>
          <Link
            href="../institutional-memory"
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Explore Memory →
          </Link>
        </div>
      </div>

      {/* Governance ethics note */}
      <div className="rounded-md border bg-slate-50 px-4 py-3 text-xs text-muted-foreground">
        All intelligence reflects organizational continuity patterns.
        No individual employee scoring, productivity analysis, or labor profiling is performed.
        Findings are subject to human review and governance oversight.
      </div>

      {/* 1. Continuity Health (uses existing panel) */}
      <Section
        title="Organizational Continuity Health"
        description="Real-time organizational knowledge fragility signals from published exit interviews."
      >
        <div className="pt-4">
          <ContinuityHealthPanel />
        </div>
      </Section>

      {/* 2. Knowledge Governance Timeline */}
      <Section
        title="Knowledge Governance Timeline"
        description="12-month view of interview capture velocity, risk trajectory, and governance activity."
      >
        <div className="pt-4">
          <GovernanceDriftTimelineContainer />
        </div>
      </Section>

      {/* 3. Succession Fragility */}
      <Section
        title="Succession Fragility Insights"
        description="Role-level documentation readiness and operational replacement gap analysis."
      >
        <SuccessionPanel />
      </Section>

      {/* 4. Organizational Topic Graph */}
      <Section
        title="Organizational Knowledge Graph"
        description="Interactive visualization of operational topic relationships across all published interviews."
        defaultOpen={false}
      >
        <div className="pt-4" style={{ height: 580 }}>
          <TopicGraphContainer />
        </div>
      </Section>

      {/* 5. Expertise Dependency Map */}
      <Section
        title="Expertise Dependency Map"
        description="Operational domain coverage by category — identifies single-source and fragile knowledge areas."
        defaultOpen={false}
      >
        <div className="pt-4">
          <ExpertiseMap />
        </div>
      </Section>

      {/* 6. Continuity Heatmap */}
      <Section
        title="Coverage Heatmap"
        description="Role × domain knowledge coverage density. Shows undocumented exposure across organizational dimensions."
        defaultOpen={false}
      >
        <div className="pt-4">
          <ContinuityHeatmapContainer />
        </div>
      </Section>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground text-center pb-4">
        Continuity Intelligence · Nzila Union Eyes · Org-scoped, governance-aware, explainable.
        Not for employee evaluation or disciplinary use.
      </p>
    </div>
  );
}
