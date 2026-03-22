/**
 * ChatOps — Slack & Teams Notifications (re-export from @nzila/chatops-*)
 *
 * Unified notification adapter for sending CFO alerts, approvals,
 * and financial summaries to Slack and Microsoft Teams channels.
 *
 * @module cfo/chatops
 */

// ── Re-exports ──────────────────────────────────────────────────────────────

export { slackAdapter } from '@nzila/chatops-slack'
export { teamsAdapter } from '@nzila/chatops-teams'

// ── CFO Facades ─────────────────────────────────────────────────────────────

import { slackAdapter } from '@nzila/chatops-slack'
import { teamsAdapter } from '@nzila/chatops-teams'

export type ChatChannel = 'slack' | 'teams' | 'both'

export interface CFONotification {
  channel: ChatChannel
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  metadata?: Record<string, string | number>
}

const SEVERITY_EMOJI: Record<CFONotification['severity'], string> = {
  info: 'ℹ️',
  warning: '⚠️',
  critical: '🚨',
}

/**
 * Send a CFO notification to the configured chat platform(s).
 */
export async function sendCFONotification(
  notification: CFONotification,
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = []
  const formattedMessage = `${SEVERITY_EMOJI[notification.severity]} *${notification.title}*\n${notification.message}`

  if (notification.channel === 'slack' || notification.channel === 'both') {
    try {
      const credentials = { token: process.env.SLACK_TOKEN ?? '' }
      await slackAdapter.send({
        orgId: '',
        channel: 'chatops',
        to: process.env.SLACK_CHANNEL ?? '#cfo-alerts',
        body: formattedMessage,
        correlationId: crypto.randomUUID(),
      }, credentials)
    } catch (err) {
      errors.push(`Slack: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  if (notification.channel === 'teams' || notification.channel === 'both') {
    try {
      const credentials = { webhookUrl: process.env.TEAMS_WEBHOOK_URL ?? '' }
      await teamsAdapter.send({
        orgId: '',
        channel: 'chatops',
        to: process.env.TEAMS_CHANNEL ?? 'CFO Alerts',
        body: formattedMessage,
        correlationId: crypto.randomUUID(),
      }, credentials)
    } catch (err) {
      errors.push(`Teams: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return { ok: errors.length === 0, errors }
}

/**
 * Send month-end close notification.
 */
export async function notifyMonthEndClose(
  period: string,
  summary: { revenue: number; expenses: number; netIncome: number },
  channel: ChatChannel = 'both',
): Promise<{ ok: boolean; errors: string[] }> {
  return sendCFONotification({
    channel,
    title: `Month-End Close: ${period}`,
    message: [
      `Revenue: $${summary.revenue.toLocaleString()}`,
      `Expenses: $${summary.expenses.toLocaleString()}`,
      `Net Income: $${summary.netIncome.toLocaleString()}`,
    ].join('\n'),
    severity: 'info',
    metadata: { period, ...summary },
  })
}

/**
 * Send approval request notification.
 */
export async function notifyApprovalRequired(
  type: string,
  amount: number,
  requester: string,
  approvalUrl: string,
  channel: ChatChannel = 'both',
): Promise<{ ok: boolean; errors: string[] }> {
  return sendCFONotification({
    channel,
    title: `Approval Required: ${type}`,
    message: `${requester} requests approval for $${amount.toLocaleString()}\nReview: ${approvalUrl}`,
    severity: 'warning',
  })
}

/**
 * Send compliance alert.
 */
export async function notifyComplianceAlert(
  alert: string,
  deadline: string,
  channel: ChatChannel = 'both',
): Promise<{ ok: boolean; errors: string[] }> {
  return sendCFONotification({
    channel,
    title: 'Compliance Alert',
    message: `${alert}\nDeadline: ${deadline}`,
    severity: 'critical',
  })
}
