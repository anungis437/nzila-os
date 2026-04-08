import type { PrioritizedWorkItem, PrioritizationResult } from '../models/types.js'

// ─── UI Component Contract ───────────────────────────────────────
// Type definitions for the WorkloadPriorityPanel component.
// These types define the data shape expected by the frontend.

/**
 * Props for the top-level WorkloadPriorityPanel component.
 */
export interface WorkloadPriorityPanelProps {
  readonly orgId: string
  readonly priorities: readonly PriorityCardData[]
  readonly generatedAt: string
  readonly isLoading: boolean
  readonly onRefresh: () => void
}

/**
 * Data shape for each priority card displayed in the panel.
 */
export interface PriorityCardData {
  readonly id: string
  readonly rank: number
  readonly priorityScore: number
  readonly priorityLevel: 'critical' | 'high' | 'medium' | 'low'
  readonly explanation: string
  readonly confidence: number
  readonly contributingFactors: readonly string[]
  readonly auditId: string
  readonly whyThisMatters: string
}

/**
 * Confidence indicator thresholds for UI rendering.
 */
export interface ConfidenceIndicator {
  readonly level: 'strong' | 'moderate' | 'weak'
  readonly color: 'green' | 'amber' | 'red'
  readonly label: string
}

/**
 * Map a PrioritizationResult to panel-ready data.
 * Takes the top 3 items and enriches with rank and tooltip content.
 */
export function toPanelData(
  result: PrioritizationResult,
): readonly PriorityCardData[] {
  return result.items.slice(0, 3).map((item, index) => ({
    id: item.id,
    rank: index + 1,
    priorityScore: item.priorityScore,
    priorityLevel: item.priorityLevel,
    explanation: item.explanation,
    confidence: item.confidence,
    contributingFactors: item.contributingFactors,
    auditId: item.auditId,
    whyThisMatters: buildWhyItMatters(item),
  }))
}

/**
 * Build a concise "why this matters" tooltip from contributing factors.
 */
function buildWhyItMatters(item: PrioritizedWorkItem): string {
  if (item.contributingFactors.length === 0) {
    return 'Standard priority — no elevated risk factors detected.'
  }

  const primary = item.contributingFactors[0]!
  if (item.priorityLevel === 'critical') {
    return `Immediate action needed: ${primary.toLowerCase()}.`
  }
  if (item.priorityLevel === 'high') {
    return `High priority: ${primary.toLowerCase()}. Review today.`
  }
  return `${primary}. Monitor and plan accordingly.`
}

/**
 * Determine confidence indicator for UI rendering.
 */
export function getConfidenceIndicator(confidence: number): ConfidenceIndicator {
  if (confidence >= 0.7) {
    return { level: 'strong', color: 'green', label: 'High confidence' }
  }
  if (confidence >= 0.4) {
    return { level: 'moderate', color: 'amber', label: 'Moderate confidence' }
  }
  return { level: 'weak', color: 'red', label: 'Low confidence — limited data' }
}
