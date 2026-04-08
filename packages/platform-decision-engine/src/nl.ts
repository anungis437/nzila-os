/**
 * @nzila/platform-decision-engine — NL decision support
 *
 * Integrates with platform-ai-query to support natural language
 * queries about decisions.
 *
 * @module @nzila/platform-decision-engine/nl
 */
import type { DecisionRecord, DecisionSummary } from './types'
import { loadAllDecisions, listOpenDecisions } from './store'
import { summariseDecisions } from './engine'

export type DecisionQueryIntent =
  | 'list_open'
  | 'list_critical'
  | 'summary'
  | 'detail'
  | 'count'
  | 'unknown'

/**
 * Classify a natural language query about decisions.
 */
export function classifyDecisionIntent(query: string): DecisionQueryIntent {
  const q = query.toLowerCase()
  if (/critical|urgent|severe/.test(q)) return 'list_critical'
  if (/open|pending|active|review/.test(q)) return 'list_open'
  if (/summary|overview|dashboard|stats/.test(q)) return 'summary'
  if (/how many|count|total/.test(q)) return 'count'
  if (/detail|show|get|find|decision\s+DEC-/i.test(q)) return 'detail'
  return 'unknown'
}

/**
 * Execute a classified decision query and return a text answer + records.
 */
export function executeDecisionQuery(
  intent: DecisionQueryIntent,
  query: string,
): { answer: string; records: DecisionRecord[]; summary?: DecisionSummary } {
  switch (intent) {
    case 'list_open': {
      const records = listOpenDecisions()
      return {
        answer: `There are ${records.length} open decision(s).`,
        records,
      }
    }
    case 'list_critical': {
      const records = loadAllDecisions().filter(
        (d) => d.severity === 'CRITICAL' && d.status !== 'CLOSED' && d.status !== 'EXPIRED',
      )
      return {
        answer: `There are ${records.length} critical open decision(s).`,
        records,
      }
    }
    case 'summary': {
      const records = loadAllDecisions()
      const summary = summariseDecisions(records)
      return {
        answer: `Decision summary: ${summary.total} total, ${summary.pending_review} pending review, ${summary.critical_open} critical open.`,
        records,
        summary,
      }
    }
    case 'count': {
      const records = loadAllDecisions()
      return {
        answer: `There are ${records.length} decision(s) in total.`,
        records,
      }
    }
    case 'detail': {
      const idMatch = query.match(/DEC-\d{4}-\d{4}/i)
      if (idMatch) {
        const records = loadAllDecisions().filter(
          (d) => d.decision_id === idMatch[0].toUpperCase(),
        )
        const first = records[0]
        return {
          answer: first
            ? `Found decision ${first.decision_id}: ${first.title}`
            : `No decision found with ID ${idMatch[0]}.`,
          records,
        }
      }
      return { answer: 'Please specify a decision ID (e.g., DEC-2025-0001).', records: [] }
    }
    default:
      return { answer: 'I can help with decision queries. Try asking about open, critical, or summary.', records: [] }
  }
}
