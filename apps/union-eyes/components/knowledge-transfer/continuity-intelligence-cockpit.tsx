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
 * Design: calm organizational intelligence. Not surveillance software.
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
  /** Always null: there is no successor or handover record to assess readiness from. */
  transitionReadinessScore: null;
  transitionReadinessBasis: 'not_assessed_no_successor_records';
  departureDocumentationCoverage: { rolesWithInterviews: number; totalRoles: number };
  roleSuccessionStatus: Array<{
    role: string;
    interviewCount: number;
    departureDocumentation: 'no_interview' | 'single_interview' | 'multiple_interviews';
    averageContinuityRiskScore: number | null;
    smallCellSuppressed?: boolean;
  }>;
  criticalOperationalGaps: string[];
  documentationPriorities: string[];
  continuityRecommendations: string[];
  executiveSummary: string;
}

/** How documented a role's departures are. Neutral colours: more departures are not better or worse readiness. */
const DOCUMENTATION_STYLE = {
  no_interview: { text: 'text-slate-500', label: 'no exit interview' },
  single_interview: { text: 'text-slate-700', label: 'one exit interview' },
  multiple_interviews: { text: 'text-slate-700', label: 'several exit interviews' },
};

const ROLE_LABELS: Record<string, string> = {
  member: 'Member',
  steward: 'Steward',
  chief_steward: 'Chief Steward',
  officer: 'Officer',
  admin: 'Admin',
};

/** Successor readiness is not assessed: the data model holds no successor, handover or documentation record, and
 *  counting exit interviews as readiness made more departures read as more readiness
 *  (DEF-0B7-COGB-SUCCESSION-READINESS-SCORE-COUNTS-EXIT-INTERVIEWS-AS-SUCCESSOR-READINESS). */
function ReadinessNotAssessed({ coverage }: { coverage: SuccessionFragilityReport['departureDocumentationCoverage'] }) {
  return (
    <div className="min-w-[11rem] space-y-1">
      <div className="text-sm font-medium text-muted-foreground">Successor readiness: not assessed</div>
      <div className="text-xs text-muted-foreground">
        No successor or handover record exists. {coverage.rolesWithInterviews} of {coverage.totalRoles} roles have a documented departure.
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
        <ReadinessNotAssessed coverage={report.departureDocumentationCoverage} />
        {report.executiveSummary && (
          <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/20 pl-3">
            {report.executiveSummary}
          </p>
        )}
      </div>

      {/* Role succession grid */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {report.roleSuccessionStatus.map((role) => {
          const style = DOCUMENTATION_STYLE[role.departureDocumentation];
          return (
            <div key={role.role} className="rounded-md border bg-card p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{ROLE_LABELS[role.role] ?? role.role}</span>
                <span className={`text-xs font-medium ${style.text}`}>{style.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {role.interviewCount} interview{role.interviewCount !== 1 ? 's' : ''}
                {role.averageContinuityRiskScore != null && role.averageContinuityRiskScore > 0 &&
                  ` · avg risk ${role.averageContinuityRiskScore}/100`}
                {role.smallCellSuppressed && ' · figures withheld (small sample)'}
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
            href="../organizational-memory"
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
        Continuity Intelligence · Nzila UnionEyes · Org-scoped, governance-aware, explainable.
        Not for employee evaluation or disciplinary use.
      </p>
    </div>
  );
}
