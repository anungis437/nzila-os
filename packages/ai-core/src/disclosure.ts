/**
 * @nzila/ai-core — Institutional Intelligence Disclosure Utility
 *
 * Provides standardised disclosure text that must be surfaced to members
 * whenever bounded institutional intelligence influences a decision about them
 * (e.g. grievance intake contextualisation, clause interpretation, rights guidance).
 *
 * Regulatory basis:
 *  - Québec Law 25 / Bill 64 (Art. 12.1 — automated decision notification)
 *  - GDPR Art. 22 — right to explanation for automated individual decisions
 *  - PIPEDA — meaningful consent for AI-driven processing
 *
 * NZ-RISK-023 — Undisclosed automated decision-making to members.
 *
 * @module disclosure
 */

// ── Notice contexts ──────────────────────────────────────────────────────────

export type AiDisclosureContext =
  | 'grievance_triage'
  | 'clause_reasoning'
  | 'chatbot'
  | 'document_extract'
  | 'generic'

// ── Structured disclosure payload ────────────────────────────────────────────

export interface AiDisclosureNotice {
  /** Short headline (suitable for tooltip or banner heading). */
  headline: string
  /** Full disclosure text for display to the member or steward. */
  body: string
  /**
   * True when Law 25 / GDPR Art. 22 applies — i.e. the AI output may
   * influence a decision that produces legal or similarly significant effects
   * on an individual member.
   */
  regulatoryScope: boolean
  /** Link to the full DPIA / Privacy Impact Assessment document (if published). */
  dpiaUrl: string | null
  /** ISO 8601 date the notice was last reviewed by the privacy team. */
  lastReviewedAt: string
}

// ── Disclosure registry ──────────────────────────────────────────────────────

const NOTICES: Record<AiDisclosureContext, AiDisclosureNotice> = {
  grievance_triage: {
    headline: 'Institutional intake reading — steward review required',
    body:
      'The priority, category, and continuity step guidance for this grievance were produced by bounded ' +
      'institutional intelligence. This output is interpretive and advisory only — it has not been accepted ' +
      'or acted upon until a steward explicitly reviews and confirms it. You have the right to request a ' +
      'human review of any interpretive reading that affects your grievance. Contact your steward or union ' +
      'representative to exercise this right.',
    regulatoryScope: true,
    dpiaUrl: null,
    lastReviewedAt: '2025-03-01',
  },
  clause_reasoning: {
    headline: 'Institutional clause interpretation',
    body:
      'The collective agreement clauses shown here were identified through bounded institutional knowledge retrieval ' +
      'based on the grievance details. These interpretations do not constitute legal advice and have not been ' +
      'verified by a labour relations officer. A qualified steward must review and confirm applicable clauses ' +
      'before citing them in any proceeding.',
    regulatoryScope: true,
    dpiaUrl: null,
    lastReviewedAt: '2025-03-01',
  },
  chatbot: {
    headline: 'Institutional rights guidance',
    body:
      'This response is produced by bounded institutional intelligence. It is for informational and continuity ' +
      'support purposes only and does not constitute legal advice, an official union position, or a commitment ' +
      'by the union. Always consult your steward or union representative for guidance on your specific situation.',
    regulatoryScope: false,
    dpiaUrl: null,
    lastReviewedAt: '2025-03-01',
  },
  document_extract: {
    headline: 'Institutional document reading',
    body:
      'The information below was extracted from uploaded documents by the institutional intelligence substrate. ' +
      'Accuracy cannot be guaranteed. Please verify extracted data against the original source document before relying on it.',
    regulatoryScope: false,
    dpiaUrl: null,
    lastReviewedAt: '2025-03-01',
  },
  generic: {
    headline: 'Institutional intelligence output',
    body:
      'This output is produced by bounded institutional intelligence. It is interpretive and advisory only — ' +
      'it does not constitute a binding decision or operational directive. ' +
      'A human operator must review and confirm any action before it takes effect.',
    regulatoryScope: false,
    dpiaUrl: null,
    lastReviewedAt: '2025-03-01',
  },
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Get the standardised AI disclosure notice for a given context.
 *
 * @example
 * const notice = getAiDisclosureNotice('grievance_triage')
 * // Render notice.headline and notice.body in the UI
 */
export function getAiDisclosureNotice(
  context: AiDisclosureContext = 'generic',
): AiDisclosureNotice {
  return NOTICES[context] ?? NOTICES['generic']
}

/**
 * Get just the disclaimer string (compatible with existing `AiResponseEnvelope.disclaimer`).
 */
export function getAiDisclaimerText(context: AiDisclosureContext = 'generic'): string {
  return getAiDisclosureNotice(context).body
}
