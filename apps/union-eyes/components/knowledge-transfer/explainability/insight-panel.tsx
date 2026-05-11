'use client';

/**
 * Insight Explainability Panel
 *
 * Renders AI-generated insights with full transparency and traceability.
 * Every AI conclusion is "openable" to reveal:
 *   - Plain-language reasoning
 *   - Source evidence from interviews
 *   - AI confidence level
 *   - Generation metadata
 *   - Human review status
 *
 * This is essential for union environments where every AI-generated
 * recommendation must be defensible, explainable, and reviewable.
 */

import { useState } from 'react';

export type InsightType =
  | 'risk_flag'
  | 'expertise_concentration'
  | 'coverage_gap'
  | 'succession_gap'
  | 'governance_drift'
  | 'single_source_topic'
  | 'undocumented_workflow';

export interface EvidenceReference {
  interviewId: string;
  interviewTitle: string;
  roleInUnion: string;
  supportingPattern: string;
}

export interface InsightExplanation {
  insightType: InsightType;
  humanReadable: string;
  reasoning: string;
  evidenceRefs: EvidenceReference[];
  confidenceLevel: 'low' | 'medium' | 'high';
  recommendation: string;
  modelProfile: string;
  generatedAt: string;
}

export interface ExplainabilityReport {
  organizationId: string;
  generatedAt: string;
  insights: InsightExplanation[];
  modelAttribution: string;
  governanceNote: string;
  reviewStatus: 'unreviewed' | 'under_review' | 'approved';
}

const CONFIDENCE_CONFIG = {
  low: { label: 'Low confidence', color: 'text-slate-500', dot: 'bg-slate-300' },
  medium: { label: 'Moderate confidence', color: 'text-blue-600', dot: 'bg-blue-400' },
  high: { label: 'High confidence', color: 'text-green-600', dot: 'bg-green-500' },
};

const INSIGHT_TYPE_LABELS: Record<InsightType, string> = {
  risk_flag: 'Risk Signal',
  expertise_concentration: 'Expertise Concentration',
  coverage_gap: 'Coverage Gap',
  succession_gap: 'Succession Gap',
  governance_drift: 'Governance Drift',
  single_source_topic: 'Single-Source Topic',
  undocumented_workflow: 'Undocumented Workflow',
};

const INSIGHT_TYPE_COLORS: Record<InsightType, string> = {
  risk_flag: 'bg-red-50 border-red-200 text-red-800',
  expertise_concentration: 'bg-orange-50 border-orange-200 text-orange-800',
  coverage_gap: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  succession_gap: 'bg-purple-50 border-purple-200 text-purple-800',
  governance_drift: 'bg-blue-50 border-blue-200 text-blue-800',
  single_source_topic: 'bg-amber-50 border-amber-200 text-amber-800',
  undocumented_workflow: 'bg-slate-50 border-slate-200 text-slate-800',
};

function InsightCard({ insight }: { insight: InsightExplanation }) {
  const [expanded, setExpanded] = useState(false);
  const confidenceConfig = CONFIDENCE_CONFIG[insight.confidenceLevel];
  const typeStyle = INSIGHT_TYPE_COLORS[insight.insightType] ?? INSIGHT_TYPE_COLORS.risk_flag;

  return (
    <div className={`rounded-lg border p-4 space-y-2 ${typeStyle}`}>
      <div className="flex items-start gap-2 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded px-1.5 py-0.5 text-xs font-medium border bg-white/60">
            {INSIGHT_TYPE_LABELS[insight.insightType]}
          </span>
          <p className="text-sm font-medium leading-snug">{insight.humanReadable}</p>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs underline underline-offset-2 opacity-70 hover:opacity-100 flex-shrink-0"
          aria-label={expanded ? 'Hide explanation' : 'Explain this'}
        >
          {expanded ? 'Hide' : 'Why?'}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 text-sm border-t border-current/10 pt-3">
          {/* Reasoning */}
          {insight.reasoning && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">Reasoning</p>
              <p className="opacity-80 leading-relaxed">{insight.reasoning}</p>
            </div>
          )}

          {/* Evidence references */}
          {insight.evidenceRefs.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1.5">
                Supporting Evidence
              </p>
              <ul className="space-y-1.5">
                {insight.evidenceRefs.map((ref, idx) => (
                  <li key={idx} className="rounded-md bg-white/50 border border-current/10 px-3 py-2 text-xs">
                    <p className="font-medium">{ref.interviewTitle}</p>
                    <p className="opacity-60">{ref.roleInUnion} interview</p>
                    {ref.supportingPattern && (
                      <p className="mt-1 italic opacity-70">"{ref.supportingPattern}"</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendation */}
          {insight.recommendation && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">
                Recommendation
              </p>
              <p className="opacity-80 leading-relaxed">{insight.recommendation}</p>
            </div>
          )}

          {/* AI metadata */}
          <div className="flex flex-wrap items-center gap-3 text-xs opacity-50 border-t border-current/10 pt-2">
            <div className="flex items-center gap-1">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${confidenceConfig.dot}`} />
              <span>{confidenceConfig.label}</span>
            </div>
            <span>Profile: {insight.modelProfile}</span>
            <span>Generated {new Date(insight.generatedAt).toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface InsightPanelProps {
  insights: InsightExplanation[];
  modelAttribution?: string;
  governanceNote?: string;
  reviewStatus?: 'unreviewed' | 'under_review' | 'approved';
  title?: string;
  emptyMessage?: string;
}

export function InsightPanel({
  insights,
  modelAttribution,
  governanceNote,
  reviewStatus = 'unreviewed',
  title = 'AI-Generated Insights',
  emptyMessage = 'No insights to display.',
}: InsightPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const displayInsights = showAll ? insights : insights.slice(0, 5);

  const reviewBadge = {
    unreviewed: 'bg-slate-100 text-slate-600',
    under_review: 'bg-blue-50 text-blue-700',
    approved: 'bg-green-50 text-green-700',
  }[reviewStatus];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${reviewBadge}`}>
            {reviewStatus.replace('_', ' ')}
          </span>
          {insights.length > 0 && (
            <span className="text-xs text-muted-foreground">{insights.length} insight{insights.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {insights.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {displayInsights.map((insight, idx) => (
            <InsightCard key={idx} insight={insight} />
          ))}
          {insights.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-sm text-primary hover:underline"
            >
              {showAll ? 'Show fewer' : `Show ${insights.length - 5} more insights`}
            </button>
          )}
        </div>
      )}

      {(modelAttribution || governanceNote) && (
        <div className="rounded-md border bg-slate-50 px-3 py-2 space-y-1">
          {modelAttribution && (
            <p className="text-xs text-muted-foreground font-mono">{modelAttribution}</p>
          )}
          {governanceNote && (
            <p className="text-xs text-muted-foreground">{governanceNote}</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline explainability badge — for use inline next to a risk score or flag.
 * Renders a "Why?" button that reveals explanation in-place.
 */
export function InlineExplainabilityBadge({
  insight,
}: {
  insight: Pick<InsightExplanation, 'humanReadable' | 'reasoning' | 'confidenceLevel' | 'recommendation'>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-primary/70 hover:text-primary underline underline-offset-2"
      >
        Why?
      </button>
      {open && (
        <span className="block rounded-md border bg-white shadow-sm p-3 text-xs max-w-xs space-y-1.5 z-10">
          <span className="block text-slate-700">{insight.humanReadable}</span>
          {insight.reasoning && (
            <span className="block text-muted-foreground leading-relaxed">{insight.reasoning}</span>
          )}
          {insight.recommendation && (
            <span className="block text-blue-700 font-medium">→ {insight.recommendation}</span>
          )}
          <span className="block text-muted-foreground">
            Confidence: {insight.confidenceLevel}
          </span>
        </span>
      )}
    </span>
  );
}
