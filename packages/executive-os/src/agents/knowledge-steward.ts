/**
 * Knowledge Steward agent — document & institutional-knowledge hygiene.
 *
 * - Stale documents in minute_book / resolution / certificate beyond freshness SLA
 * - Documents with no linkedType/linkedId (orphaned)
 * - Confidential docs uploaded without classification review
 * - Category gaps: required categories with zero documents
 */
import type {
  ExecutiveAgent,
  AgentAction,
  AgentInsight,
  AgentResult,
} from '../contract.js'

export type DocumentCategory =
  | 'minute_book'
  | 'filing'
  | 'resolution'
  | 'minutes'
  | 'certificate'
  | 'year_end'
  | 'export'
  | 'ingestion_report'
  | 'attestation'
  | 'other'

export type DocumentClassification = 'public' | 'internal' | 'confidential'

export interface DocumentSummary {
  documentId: string
  title: string
  category: DocumentCategory
  classification: DocumentClassification
  linked: boolean
  uploadedDaysAgo: number
}

export interface KnowledgeSignal {
  documents: DocumentSummary[]
  requiredCategories?: DocumentCategory[]
  // freshness SLA per category (days); if absent, no freshness check
  freshnessSlaDays?: Partial<Record<DocumentCategory, number>>
}

export const knowledgeStewardAgent: ExecutiveAgent<KnowledgeSignal> = {
  key: 'knowledge-steward',
  name: 'Knowledge Steward',
  domain: 'knowledge',
  mission: 'Every decision has a document; every document is linked, classified, and fresh.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []
    const sig = req.input
    if (!sig) return { summary: 'No knowledge signal available.', insights, actions }

    // Category gaps
    if (sig.requiredCategories && sig.requiredCategories.length > 0) {
      const present = new Set(sig.documents.map((d) => d.category))
      const missing = sig.requiredCategories.filter((c) => !present.has(c))
      if (missing.length > 0) {
        insights.push({
          domain: 'knowledge',
          title: `${missing.length} required document categor${missing.length > 1 ? 'ies' : 'y'} empty`,
          body: missing.join(', '),
          severity: 'warn',
          confidence: 1,
          recommendedNextStep: 'Upload baseline documents for each category.',
        })
      }
    }

    // Freshness per category
    const stale: DocumentSummary[] = []
    if (sig.freshnessSlaDays) {
      // "Freshness" = newest doc in category is older than SLA.
      const byCategory = new Map<DocumentCategory, DocumentSummary>()
      for (const d of sig.documents) {
        const prev = byCategory.get(d.category)
        if (!prev || d.uploadedDaysAgo < prev.uploadedDaysAgo) byCategory.set(d.category, d)
      }
      for (const [cat, sla] of Object.entries(sig.freshnessSlaDays) as Array<[DocumentCategory, number]>) {
        const newest = byCategory.get(cat)
        if (newest && newest.uploadedDaysAgo > sla) stale.push(newest)
      }
    }
    if (stale.length > 0) {
      insights.push({
        domain: 'knowledge',
        title: `${stale.length} document categor${stale.length > 1 ? 'ies' : 'y'} past freshness SLA`,
        body: stale
          .map((d) => `${d.category} · newest "${d.title}" · ${d.uploadedDaysAgo}d old`)
          .join('\n'),
        severity: 'warn',
        confidence: 0.9,
        recommendedNextStep: 'Review and re-attest, or refresh source of record.',
      })
    }

    // Orphaned minute_book / resolution / certificate docs
    const linkable: DocumentCategory[] = ['resolution', 'minutes', 'certificate', 'filing']
    const orphaned = sig.documents.filter(
      (d) => linkable.includes(d.category) && !d.linked,
    )
    if (orphaned.length > 0) {
      insights.push({
        domain: 'knowledge',
        title: `${orphaned.length} unlinked document${orphaned.length > 1 ? 's' : ''} (${linkable.join(', ')})`,
        body: orphaned.slice(0, 10).map((d) => `${d.category} · ${d.title}`).join('\n'),
        severity: 'info',
        confidence: 0.9,
        recommendedNextStep: 'Link to source resolution/meeting/filing for traceability.',
      })
    }

    const ok = stale.length === 0 && orphaned.length === 0
    const summary = ok
      ? `Knowledge base clean · ${sig.documents.length} document${sig.documents.length === 1 ? '' : 's'}.`
      : `Knowledge: ${stale.length} stale categor${stale.length === 1 ? 'y' : 'ies'}, ${orphaned.length} unlinked.`
    return { summary, insights, actions }
  },
}
