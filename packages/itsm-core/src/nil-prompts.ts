/**
 * @nzila/itsm-core — NIL Prompt Contracts
 *
 * Pre-built use-case definitions for the Nzila Intelligence Layer (NIL)
 * that power ITSM intelligence capabilities.
 *
 * Use-cases:
 *   - itsm_ticket_triage        Auto-assign priority, queue, and category
 *   - itsm_sla_breach_prediction Predict imminent SLA breaches
 *   - itsm_duplicate_detection   Find duplicate/related open tickets
 *   - itsm_kb_suggest            Recommend KB articles for a ticket
 *   - itsm_response_draft        Draft an agent response for a ticket
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface ItsmPromptContract {
  /** Stable use-case key for NIL routing — matches `IntelligenceRequest.useCase` */
  readonly useCase: string
  /** App identifier — always 'itsm' */
  readonly app: 'itsm'
  /** Human-readable description of what this use-case does */
  readonly description: string
  /** Input schema description for documentation */
  readonly inputFields: readonly string[]
}

// ── Use-Case Definitions ────────────────────────────────────────────────────

/**
 * Auto-triage a new ticket: derive priority, suggested queue, and category
 * from the free-text subject and description.
 */
export const ITSM_TICKET_TRIAGE: ItsmPromptContract = {
  useCase: 'itsm_ticket_triage',
  app: 'itsm',
  description:
    'Analyse a new ticket subject and description to suggest priority, queue, and category.',
  inputFields: ['ticketSubject', 'ticketDescription', 'orgId', 'reporterRole'],
}

/**
 * Predict whether a ticket is at risk of breaching its SLA targets
 * given current status, elapsed time, and team load.
 */
export const ITSM_SLA_BREACH_PREDICTION: ItsmPromptContract = {
  useCase: 'itsm_sla_breach_prediction',
  app: 'itsm',
  description:
    'Score SLA breach probability for in-flight tickets based on age, priority, and queue depth.',
  inputFields: ['ticketId', 'priority', 'elapsedMinutes', 'queueDepth', 'slaTargetMinutes'],
}

/**
 * Detect duplicate or closely related open tickets to surface before
 * an agent starts working on a new one.
 */
export const ITSM_DUPLICATE_DETECTION: ItsmPromptContract = {
  useCase: 'itsm_duplicate_detection',
  app: 'itsm',
  description:
    'Find semantically similar open tickets to prevent duplicate effort and link related work.',
  inputFields: ['ticketSubject', 'ticketDescription', 'orgId', 'recentTicketEmbeddings'],
}

/**
 * Recommend relevant Knowledge Base articles for an in-flight ticket
 * to accelerate resolution.
 */
export const ITSM_KB_SUGGEST: ItsmPromptContract = {
  useCase: 'itsm_kb_suggest',
  app: 'itsm',
  description: 'Surface the top KB articles most relevant to a given ticket.',
  inputFields: ['ticketSubject', 'ticketDescription', 'category', 'orgId'],
}

/**
 * Draft a professional first-response or update message for an agent
 * to review, edit, and send.
 */
export const ITSM_RESPONSE_DRAFT: ItsmPromptContract = {
  useCase: 'itsm_response_draft',
  app: 'itsm',
  description:
    'Generate a draft agent response (acknowledgement or resolution note) ready for review.',
  inputFields: ['ticketSubject', 'ticketDescription', 'currentStatus', 'responseType', 'orgId'],
}

// ── Registry ────────────────────────────────────────────────────────────────

export const ITSM_USE_CASES: readonly ItsmPromptContract[] = [
  ITSM_TICKET_TRIAGE,
  ITSM_SLA_BREACH_PREDICTION,
  ITSM_DUPLICATE_DETECTION,
  ITSM_KB_SUGGEST,
  ITSM_RESPONSE_DRAFT,
] as const

/** All ITSM use-case keys — useful for routing table validation */
export const ITSM_USE_CASE_KEYS = ITSM_USE_CASES.map((uc) => uc.useCase)
