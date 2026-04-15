/**
 * Flow — Control Layer Types
 *
 * Canonical types for the command-driven control layer.
 * All critical business mutations flow through this layer.
 */

// ── Command Context ────────────────────────────────────────────────────────

export interface CommandContext {
  org_id: string
  actor_id?: string
  correlation_id?: string
  environment?: 'local' | 'dev' | 'staging' | 'prod'
  request_source?: string
}

// ── Command Result ─────────────────────────────────────────────────────────

export interface CommandError {
  code: string
  message: string
  details?: unknown
}

export interface CommandResult {
  success: boolean
  entity_type?: string
  entity_id?: string
  status_after?: string
  emitted_event_ids?: string[]
  audit_ref?: string
  message?: string
  warnings?: string[]
  errors?: CommandError[]
}

// ── Guard Results ──────────────────────────────────────────────────────────

export interface InvariantCheckResult {
  valid: boolean
  violations: string[]
}

export interface WorkflowCheckResult {
  allowed: boolean
  from: string
  to: string
  reason?: string
}

export type PaymentGateState = 'clear' | 'blocked' | 'warning'

export interface PaymentGateCheckResult {
  allowed: boolean
  gate_state: PaymentGateState
  reasons: string[]
  required_actions: string[]
  snapshot: {
    order_id?: string
    payment_status: string
    amount_due: number
    amount_paid: number
    deposit_required: boolean
    due_before_production: boolean
  }
}

export interface ProductionGateCheckResult {
  allowed: boolean
  blockers: string[]
  order_id: string
  po_valid: boolean
  payment_cleared: boolean
  vendor_assigned: boolean
  proofing_satisfied: boolean
}

export interface ShipmentGateCheckResult {
  allowed: boolean
  blockers: string[]
  order_id: string
  production_complete: boolean
  shipping_address_exists: boolean
}

// ── Handler Interface ──────────────────────────────────────────────────────

export interface CommandHandler<TCommand> {
  readonly commandType: string
  execute(command: TCommand, context: CommandContext): Promise<CommandResult>
}
