/**
 * ABR Integration Events — Dispatcher-Only Outbound Communications
 *
 * Maps ABR notification/communication needs to integrations-runtime dispatcher events.
 * ABR MUST NOT use direct SDK calls for email, SMS, webhooks, or CRM.
 */
import type {
  SendRequest,
  SendResult,
  IntegrationType,
} from '@nzila/integrations-core'
import type { ResilientDispatcher } from '@nzila/integrations-runtime'

/** Any dispatcher with a compatible dispatch() method (IntegrationDispatcher or ResilientDispatcher). */
type Dispatcher = { dispatch(request: SendRequest): Promise<SendResult> }

/** Re-export for consumers that wire up the dispatcher. */
export type { ResilientDispatcher }

// ── ABR Integration Event Types ───────────────────────────────────────────

export const AbrIntegrationEvent = {
  /** Case status notification to stakeholders */
  CASE_STATUS_NOTIFICATION: 'abr.case.status_notification',

  /** Decision issued — notify respondent + complainant */
  DECISION_NOTIFICATION: 'abr.decision.notification',

  /** Compliance report ready — notify org admins */
  COMPLIANCE_REPORT_READY: 'abr.compliance_report.ready',

  /** Export completed — notify requester */
  EXPORT_COMPLETED: 'abr.export.completed',

  /** Case escalation — notify supervisors */
  CASE_ESCALATION: 'abr.case.escalation',

  /** Deadline approaching — notify assigned officers */
  DEADLINE_REMINDER: 'abr.deadline.reminder',
} as const

export type AbrIntegrationEvent =
  (typeof AbrIntegrationEvent)[keyof typeof AbrIntegrationEvent]

// ── Dispatcher Request Builder ─────────────────────────────────────────────

export interface AbrNotificationRequest {
  event: AbrIntegrationEvent
  orgId: string
  recipientRef: string
  channel: IntegrationType
  correlationId: string
  templateId?: string
  payload: Record<string, unknown>
}

/**
 * Build a SendRequest for the integrations-runtime dispatcher.
 *
 * ABR MUST ONLY use this function to send outbound communications.
 * Direct SDK calls to email/SMS/webhook/CRM providers are forbidden.
 */
export function buildAbrSendRequest(req: AbrNotificationRequest): SendRequest {
  return {
    orgId: req.orgId,
    channel: req.channel,
    to: req.recipientRef,
    templateId: req.templateId,
    correlationId: req.correlationId,
    variables: {
      ...req.payload,
      _abrEvent: req.event,
      _app: 'abr',
    },
  }
}

/**
 * Send an ABR notification via the integrations-runtime dispatcher.
 *
 * Convenience wrapper that builds the request and dispatches it.
 */
export async function dispatchAbrNotification(
  dispatcher: Dispatcher,
  req: AbrNotificationRequest,
): Promise<void> {
  const sendRequest = buildAbrSendRequest(req)
  await dispatcher.dispatch(sendRequest)
}
