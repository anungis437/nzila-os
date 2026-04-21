/**
 * ExecutiveOS ↔ NIL capability registration.
 *
 * Registers our intelligence-layer capabilities so other apps (and the NIL
 * catalog) can discover them via `resolveCapability('console', useCase)`.
 *
 * Idempotent: `registerExecutiveCapabilities()` is safe to call multiple
 * times; duplicates are silently skipped.
 */
import { getCapability, registerCapability } from '@nzila/intelligence'
import type { IntelligenceCapability } from '@nzila/intelligence'

export const EXECUTIVE_CAPABILITIES: ReadonlyArray<IntelligenceCapability> = [
  {
    id: 'executive-priority-ranking',
    name: 'Executive Priority Ranking',
    description:
      'Canonical explainable ranking engine for executive recommendations. Produces a 0–100 score, bucket (now/today/this_week/this_month/backlog), and top-factor explanation.',
    supportedApps: ['console'],
    useCases: ['rank-recommendations', 'prioritize-actions', 'explain-score'],
    version: '0.1.0',
  },
  {
    id: 'cross-domain-risk-scan',
    name: 'Cross-Domain Risk Scan',
    description:
      'Detects compound risks spanning multiple domains (churn × support burden, AR × health, premium incidents, runway × grants, portfolio drag).',
    supportedApps: ['console'],
    useCases: ['detect-compound-risk', 'risk-radar'],
    version: '0.1.0',
  },
  {
    id: 'opportunity-ranking',
    name: 'Cross-Domain Opportunity Ranking',
    description:
      'Surfaces ranked opportunities (grants elevated by runway pressure, portfolio-drag pause recommendations, expansion plays).',
    supportedApps: ['console'],
    useCases: ['rank-opportunities', 'opportunity-radar'],
    version: '0.1.0',
  },
  {
    id: 'weekly-ceo-brief-v2',
    name: 'Weekly CEO Brief v2',
    description:
      'Multi-agent synthesis producing the weekly executive briefing: top priorities, silent agents, recurring themes, net-new insights.',
    supportedApps: ['console'],
    useCases: ['executive-briefing', 'weekly-digest'],
    version: '0.2.0',
  },
  {
    id: 'recommendation-retrospective',
    name: 'Recommendation Retrospective',
    description:
      'Queries the learning-loop tables (executive_recommendations, feedback, outcomes) to surface closed-loop quality metrics and priority drift.',
    supportedApps: ['console'],
    useCases: ['retro-analysis', 'priority-drift'],
    version: '0.1.0',
  },
  {
    id: 'focus-allocation-v2',
    name: 'Founder Focus Allocation v2',
    description:
      'Allocates founder capacity across ventures using logged hours, target hours, and portfolio rank. Feeds /chief-of-staff/focus.',
    supportedApps: ['console'],
    useCases: ['founder-focus', 'time-allocation'],
    version: '0.2.0',
  },
  {
    id: 'founder-capacity-analysis',
    name: 'Founder Capacity Analysis',
    description:
      'Flags portfolio items consuming disproportionate founder time vs strategic fit and revenue contribution.',
    supportedApps: ['console'],
    useCases: ['capacity-diagnosis', 'portfolio-drag'],
    version: '0.1.0',
  },
]

/**
 * Register all ExecutiveOS capabilities with the NIL registry.
 * Idempotent — duplicate ids are skipped silently.
 */
export function registerExecutiveCapabilities(): {
  registered: string[]
  skipped: string[]
} {
  const registered: string[] = []
  const skipped: string[] = []
  for (const cap of EXECUTIVE_CAPABILITIES) {
    if (getCapability(cap.id)) {
      skipped.push(cap.id)
      continue
    }
    registerCapability(cap)
    registered.push(cap.id)
  }
  return { registered, skipped }
}
