import { z } from 'zod'

/**
 * Strict command contract for the orchestrator.
 * Every command from the outer loop (WhatsApp / webhook / CLI)
 * must conform to this schema before execution.
 */

export const PlaybookName = z.enum([
  // Platform CI/automation playbooks
  'contract_guardian',
  'lint_check',
  'typecheck',
  'unit_tests',
  'full_ci',
  // Domain workflow playbooks (dispatched by platform apps)
  'evidence_seal',        // union-eyes: seal case evidence bundle at terminal state
  'sla_escalation',       // union-eyes: trigger SLA breach escalation notifications
  'reminder_dispatch',    // flow: send scheduled invoice/follow-up reminders
  'onboarding_trigger',   // flow: kick off new org onboarding automation
])
export type PlaybookName = z.infer<typeof PlaybookName>

export const CommandSchema = z.object({
  /** Caller-supplied correlation ID (UUID v4) */
  correlation_id: z.string().uuid(),
  /** Which playbook to dispatch */
  playbook: PlaybookName,
  /** If true, no mutations (issues, PRs, deploys) */
  dry_run: z.boolean().default(true),
  /** Freeform args passed through to the workflow */
  args: z.record(z.string(), z.unknown()).default({}),
  /** Who requested this (WhatsApp number, API key ID, etc.) */
  requested_by: z.string().min(1),
})
export type Command = z.infer<typeof CommandSchema>

export const CommandStatus = z.enum([
  'pending',
  'approved',
  'dispatched',
  'running',
  'succeeded',
  'failed',
  'cancelled',
])
export type CommandStatus = z.infer<typeof CommandStatus>

export interface CommandRecord {
  id: string
  org_id: string
  correlation_id: string
  idempotency_key: string
  playbook: PlaybookName
  status: CommandStatus
  version: number
  attempt_count: number
  dry_run: boolean
  requested_by: string
  args: Record<string, unknown>
  run_id: string | null
  run_url: string | null
  error_message?: string | null
  execution_owner?: string | null
  lease_expires_at?: string | null
  last_heartbeat_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  created_at: string
  updated_at: string
}
