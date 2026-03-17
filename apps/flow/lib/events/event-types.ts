/**
 * Flow — Domain Event Definitions
 *
 * All important actions in Flow emit structured audit events.
 * Every event includes: actor_id, org_id, entity_id, timestamp, metadata.
 */
import { z } from 'zod'

// ── Event Types ────────────────────────────────────────────────────────────

export const FlowEventType = z.enum([
  // Quote lifecycle
  'quote_created',
  'quote_sent',
  'quote_accepted',
  'quote_rejected',
  'quote_revision_requested',
  'quote_expired',

  // Order lifecycle
  'order_created',
  'order_confirmed',
  'order_cancelled',
  'order_ready_for_procurement',
  'order_ready_to_ship',
  'order_shipped',
  'order_delivered',
  'order_closed',

  // Payment
  'payment_received',
  'deposit_required',
  'payment_overdue',

  // Purchase Order
  'po_created',
  'po_sent',
  'po_confirmed',
  'po_in_production',
  'po_shipped',
  'po_received',

  // Production
  'proof_sent',
  'proof_approved',
  'proof_rejected',
  'production_started',
  'production_completed',
  'quality_check_started',
  'quality_check_failed',

  // System
  'payment_gate_blocked',
  'policy_denied',
  'anomaly_detected',
])
export type FlowEventType = z.infer<typeof FlowEventType>

// ── Event Schema ───────────────────────────────────────────────────────────

export const FlowEventSchema = z.object({
  id: z.string().uuid(),
  type: FlowEventType,
  actor_id: z.string().min(1),
  org_id: z.string().min(1),
  entity_type: z.string().min(1),
  entity_id: z.string().uuid(),
  timestamp: z.coerce.date(),
  metadata: z.record(z.unknown()).default({}),
})
export type FlowEvent = z.infer<typeof FlowEventSchema>

// ── Event Input (for creating events) ──────────────────────────────────────

export const EmitEventInput = z.object({
  type: FlowEventType,
  actor_id: z.string().min(1),
  org_id: z.string().min(1),
  entity_type: z.string().min(1),
  entity_id: z.string().uuid(),
  metadata: z.record(z.unknown()).default({}),
})
export type EmitEventInput = z.infer<typeof EmitEventInput>
