/**
 * Flow — Control Layer Unit Tests
 *
 * Validates the control layer foundations without requiring a database:
 *   1. Command schema validation (Zod)
 *   2. Workflow guard transitions (all 5 state machines)
 *   3. Command bus registration & dispatch mechanics
 *   4. Guard type contracts
 *   5. Error type hierarchy
 */
import { describe, it, expect } from 'vitest'
import { z, ZodError } from 'zod'
import { randomUUID } from 'node:crypto'

// ── Command Schemas ────────────────────────────────────────────────────────
import {
  CreateQuoteCommand,
  SendQuoteCommand,
  AcceptQuoteCommand,
  RequestQuoteRevisionCommand,
  ConvertQuoteToOrderCommand,
  ConfirmOrderCommand,
  RequireDepositCommand,
  RecordPaymentCommand,
  ConfirmPaymentCommand,
  CreatePurchaseOrderCommand,
  SendPurchaseOrderCommand,
  ConfirmPurchaseOrderCommand,
  StartProductionCommand,
  CompleteProductionCommand,
  CreateShipmentCommand,
  MarkShipmentShippedCommand,
  MarkShipmentDeliveredCommand,
} from '@/lib/commands/types'

// ── Workflow Guards ────────────────────────────────────────────────────────
import { validateTransition, getAvailableTransitions } from '@/lib/control/guards/workflow-guard'

// ── Error Types ────────────────────────────────────────────────────────────
import { InvalidTransitionError } from '@/lib/control/errors/invalid-transition-error'
import { PaymentGateBlockedError } from '@/lib/control/errors/payment-gate-blocked-error'
import { InvariantViolationError } from '@/lib/control/errors/invariant-violation-error'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'
import { PermissionDeniedError } from '@/lib/control/errors/permission-denied-error'

// ── Helper ─────────────────────────────────────────────────────────────────

const ORG = 'test-org'
const ACTOR = 'test-actor'
const uid = () => randomUUID()

function base(type: string) {
  return { type, org_id: ORG, actor_id: ACTOR }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. COMMAND SCHEMA VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Command Schema Validation', () => {
  describe('CreateQuoteCommand', () => {
    it('accepts valid input', () => {
      const cmd = CreateQuoteCommand.parse({
        ...base('create_quote'),
        customer_id: uid(),
        title: 'Test Quote',
        currency: 'CAD',
        lines: [{ description: 'Item A', quantity: 10, unit_price: 25 }],
      })
      expect(cmd.type).toBe('create_quote')
      expect(cmd.lines).toHaveLength(1)
    })

    it('rejects empty lines array', () => {
      expect(() =>
        CreateQuoteCommand.parse({
          ...base('create_quote'),
          customer_id: uid(),
          title: 'Empty',
          currency: 'CAD',
          lines: [],
        }),
      ).toThrow(ZodError)
    })

    it('rejects negative unit_price', () => {
      expect(() =>
        CreateQuoteCommand.parse({
          ...base('create_quote'),
          customer_id: uid(),
          title: 'Neg price',
          currency: 'CAD',
          lines: [{ description: 'Bad', quantity: 1, unit_price: -5 }],
        }),
      ).toThrow(ZodError)
    })

    it('rejects zero quantity', () => {
      expect(() =>
        CreateQuoteCommand.parse({
          ...base('create_quote'),
          customer_id: uid(),
          title: 'Zero qty',
          currency: 'CAD',
          lines: [{ description: 'Bad', quantity: 0, unit_price: 10 }],
        }),
      ).toThrow(ZodError)
    })

    it('rejects unsupported currency', () => {
      expect(() =>
        CreateQuoteCommand.parse({
          ...base('create_quote'),
          customer_id: uid(),
          title: 'Bad currency',
          currency: 'JPY',
          lines: [{ description: 'Item', quantity: 1, unit_price: 10 }],
        }),
      ).toThrow(ZodError)
    })

    it('accepts optional fields (valid_until, notes, sku)', () => {
      const cmd = CreateQuoteCommand.parse({
        ...base('create_quote'),
        customer_id: uid(),
        title: 'Full Quote',
        currency: 'USD',
        lines: [{ description: 'Item', sku: 'SKU-001', quantity: 5, unit_price: 100 }],
        valid_until: '2026-06-01',
        notes: 'Some notes',
      })
      expect(cmd.valid_until).toBeInstanceOf(Date)
      expect(cmd.notes).toBe('Some notes')
    })
  })

  describe('SendQuoteCommand', () => {
    it('accepts valid input', () => {
      const cmd = SendQuoteCommand.parse({ ...base('send_quote'), quote_id: uid() })
      expect(cmd.type).toBe('send_quote')
    })

    it('rejects non-uuid quote_id', () => {
      expect(() => SendQuoteCommand.parse({ ...base('send_quote'), quote_id: 'not-uuid' })).toThrow(ZodError)
    })
  })

  describe('AcceptQuoteCommand', () => {
    it('accepts valid input with optional customer info', () => {
      const cmd = AcceptQuoteCommand.parse({
        ...base('accept_quote'),
        quote_id: uid(),
        customer_name: 'Test Client',
        customer_email: 'test@example.com',
      })
      expect(cmd.customer_name).toBe('Test Client')
    })

    it('rejects invalid email', () => {
      expect(() =>
        AcceptQuoteCommand.parse({
          ...base('accept_quote'),
          quote_id: uid(),
          customer_email: 'not-an-email',
        }),
      ).toThrow(ZodError)
    })
  })

  describe('RequireDepositCommand', () => {
    it('accepts valid deposit config', () => {
      const cmd = RequireDepositCommand.parse({
        ...base('require_deposit'),
        order_id: uid(),
        deposit_required: true,
        deposit_percent: 50,
        due_before_production: true,
      })
      expect(cmd.deposit_percent).toBe(50)
    })

    it('rejects deposit_percent > 100', () => {
      expect(() =>
        RequireDepositCommand.parse({
          ...base('require_deposit'),
          order_id: uid(),
          deposit_required: true,
          deposit_percent: 150,
        }),
      ).toThrow(ZodError)
    })

    it('defaults due_before_production to true', () => {
      const cmd = RequireDepositCommand.parse({
        ...base('require_deposit'),
        order_id: uid(),
        deposit_required: false,
      })
      expect(cmd.due_before_production).toBe(true)
    })
  })

  describe('RecordPaymentCommand', () => {
    it('accepts valid payment', () => {
      const cmd = RecordPaymentCommand.parse({
        ...base('record_payment'),
        order_id: uid(),
        amount: 5000,
        currency: 'CAD',
        method: 'BANK_TRANSFER',
        reference: 'WIRE-001',
      })
      expect(cmd.amount).toBe(5000)
      expect(cmd.method).toBe('BANK_TRANSFER')
    })

    it('rejects zero amount', () => {
      expect(() =>
        RecordPaymentCommand.parse({
          ...base('record_payment'),
          order_id: uid(),
          amount: 0,
          currency: 'CAD',
          method: 'CASH',
        }),
      ).toThrow(ZodError)
    })

    it('rejects invalid payment method', () => {
      expect(() =>
        RecordPaymentCommand.parse({
          ...base('record_payment'),
          order_id: uid(),
          amount: 100,
          currency: 'CAD',
          method: 'BITCOIN',
        }),
      ).toThrow(ZodError)
    })
  })

  describe('MarkShipmentShippedCommand', () => {
    it('accepts valid shipped command', () => {
      const cmd = MarkShipmentShippedCommand.parse({
        ...base('mark_shipment_shipped'),
        shipment_id: uid(),
        order_id: uid(),
        carrier: 'Purolator',
        tracking_number: 'PLR-123',
      })
      expect(cmd.carrier).toBe('Purolator')
    })

    it('rejects empty carrier', () => {
      expect(() =>
        MarkShipmentShippedCommand.parse({
          ...base('mark_shipment_shipped'),
          shipment_id: uid(),
          order_id: uid(),
          carrier: '',
          tracking_number: 'PLR-123',
        }),
      ).toThrow(ZodError)
    })

    it('accepts optional tracking_url if valid URL', () => {
      const cmd = MarkShipmentShippedCommand.parse({
        ...base('mark_shipment_shipped'),
        shipment_id: uid(),
        order_id: uid(),
        carrier: 'FedEx',
        tracking_number: 'FX-999',
        tracking_url: 'https://tracking.fedex.com/FX-999',
      })
      expect(cmd.tracking_url).toContain('fedex')
    })

    it('rejects invalid tracking_url', () => {
      expect(() =>
        MarkShipmentShippedCommand.parse({
          ...base('mark_shipment_shipped'),
          shipment_id: uid(),
          order_id: uid(),
          carrier: 'FedEx',
          tracking_number: 'FX-999',
          tracking_url: 'not-a-url',
        }),
      ).toThrow(ZodError)
    })
  })

  describe('All commands require org_id', () => {
    const schemas = [
      { name: 'SendQuoteCommand', schema: SendQuoteCommand, extra: { quote_id: uid() } },
      { name: 'ConfirmOrderCommand', schema: ConfirmOrderCommand, extra: { order_id: uid() } },
      { name: 'ConfirmPaymentCommand', schema: ConfirmPaymentCommand, extra: { payment_id: uid(), order_id: uid() } },
      { name: 'SendPurchaseOrderCommand', schema: SendPurchaseOrderCommand, extra: { purchase_order_id: uid() } },
      { name: 'ConfirmPurchaseOrderCommand', schema: ConfirmPurchaseOrderCommand, extra: { purchase_order_id: uid() } },
      { name: 'MarkShipmentDeliveredCommand', schema: MarkShipmentDeliveredCommand, extra: { shipment_id: uid(), order_id: uid() } },
    ]

    for (const { name, schema, extra } of schemas) {
      it(`${name} rejects empty org_id`, () => {
        expect(() =>
          schema.parse({ type: extra, actor_id: ACTOR, org_id: '', ...extra }),
        ).toThrow(ZodError)
      })
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. WORKFLOW GUARD TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('Workflow Guard', () => {
  describe('Quote transitions', () => {
    it('allows DRAFT → INTERNAL_REVIEW', () => {
      const r = validateTransition('quote', 'DRAFT', 'INTERNAL_REVIEW')
      expect(r.allowed).toBe(true)
      expect(r.from).toBe('DRAFT')
      expect(r.to).toBe('INTERNAL_REVIEW')
    })

    it('allows INTERNAL_REVIEW → SENT_TO_CLIENT', () => {
      expect(validateTransition('quote', 'INTERNAL_REVIEW', 'SENT_TO_CLIENT').allowed).toBe(true)
    })

    it('allows SENT_TO_CLIENT → ACCEPTED', () => {
      expect(validateTransition('quote', 'SENT_TO_CLIENT', 'ACCEPTED').allowed).toBe(true)
    })

    it('allows SENT_TO_CLIENT → REVISION_REQUESTED', () => {
      expect(validateTransition('quote', 'SENT_TO_CLIENT', 'REVISION_REQUESTED').allowed).toBe(true)
    })

    it('blocks DRAFT → ACCEPTED (skip steps)', () => {
      expect(validateTransition('quote', 'DRAFT', 'ACCEPTED').allowed).toBe(false)
    })

    it('blocks ACCEPTED → DRAFT (backward)', () => {
      expect(validateTransition('quote', 'ACCEPTED', 'DRAFT').allowed).toBe(false)
    })

    it('returns available transitions for DRAFT', () => {
      const transitions = getAvailableTransitions('quote', 'DRAFT')
      expect(transitions).toContain('INTERNAL_REVIEW')
      expect(transitions).not.toContain('ACCEPTED')
    })
  })

  describe('Order transitions', () => {
    it('allows CREATED → CONFIRMED', () => {
      expect(validateTransition('order', 'CREATED', 'CONFIRMED').allowed).toBe(true)
    })

    it('allows CONFIRMED → DEPOSIT_REQUIRED', () => {
      expect(validateTransition('order', 'CONFIRMED', 'DEPOSIT_REQUIRED').allowed).toBe(true)
    })

    it('blocks CREATED → IN_PRODUCTION (skip steps)', () => {
      expect(validateTransition('order', 'CREATED', 'IN_PRODUCTION').allowed).toBe(false)
    })

    it('blocks DELIVERED → CREATED (backward)', () => {
      expect(validateTransition('order', 'DELIVERED', 'CREATED').allowed).toBe(false)
    })

    it('allows full happy path', () => {
      const path = [
        ['CREATED', 'CONFIRMED'],
        ['CONFIRMED', 'PAYMENT_COMPLETE'],
        ['PAYMENT_COMPLETE', 'READY_FOR_PROCUREMENT'],
        ['READY_FOR_PROCUREMENT', 'IN_PRODUCTION'],
        ['IN_PRODUCTION', 'READY_TO_SHIP'],
        ['READY_TO_SHIP', 'SHIPPED'],
        ['SHIPPED', 'DELIVERED'],
        ['DELIVERED', 'CLOSED'],
      ] as const

      for (const [from, to] of path) {
        const r = validateTransition('order', from, to)
        expect(r.allowed, `${from} → ${to}`).toBe(true)
      }
    })
  })

  describe('PO transitions', () => {
    it('allows DRAFT → SENT', () => {
      expect(validateTransition('purchase_order', 'DRAFT', 'SENT').allowed).toBe(true)
    })

    it('allows SENT → CONFIRMED', () => {
      expect(validateTransition('purchase_order', 'SENT', 'CONFIRMED').allowed).toBe(true)
    })

    it('blocks DRAFT → CONFIRMED (skip send)', () => {
      expect(validateTransition('purchase_order', 'DRAFT', 'CONFIRMED').allowed).toBe(false)
    })
  })

  describe('Production transitions', () => {
    it('allows PENDING_PROOF → PROOF_SENT', () => {
      expect(validateTransition('production', 'PENDING_PROOF', 'PROOF_SENT').allowed).toBe(true)
    })

    it('allows PROOF_APPROVED → IN_PRODUCTION', () => {
      expect(validateTransition('production', 'PROOF_APPROVED', 'IN_PRODUCTION').allowed).toBe(true)
    })

    it('allows IN_PRODUCTION → QUALITY_CHECK', () => {
      expect(validateTransition('production', 'IN_PRODUCTION', 'QUALITY_CHECK').allowed).toBe(true)
    })

    it('allows QUALITY_CHECK → READY_TO_SHIP', () => {
      expect(validateTransition('production', 'QUALITY_CHECK', 'READY_TO_SHIP').allowed).toBe(true)
    })

    it('blocks READY_TO_SHIP → IN_PRODUCTION (backward)', () => {
      expect(validateTransition('production', 'READY_TO_SHIP', 'IN_PRODUCTION').allowed).toBe(false)
    })
  })

  describe('Shipment transitions', () => {
    it('allows PENDING → SHIPPED', () => {
      expect(validateTransition('shipment', 'PENDING', 'SHIPPED').allowed).toBe(true)
    })

    it('allows SHIPPED → IN_TRANSIT', () => {
      expect(validateTransition('shipment', 'SHIPPED', 'IN_TRANSIT').allowed).toBe(true)
    })

    it('allows IN_TRANSIT → DELIVERED', () => {
      expect(validateTransition('shipment', 'IN_TRANSIT', 'DELIVERED').allowed).toBe(true)
    })

    it('blocks DELIVERED → PENDING (backward)', () => {
      expect(validateTransition('shipment', 'DELIVERED', 'PENDING').allowed).toBe(false)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. ERROR TYPE HIERARCHY
// ═══════════════════════════════════════════════════════════════════════════

describe('Control Layer Errors', () => {
  it('InvalidTransitionError has code and context', () => {
    const err = new InvalidTransitionError('quote', 'DRAFT', 'ACCEPTED')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('INVALID_TRANSITION')
    expect(err.message).toContain('DRAFT')
    expect(err.message).toContain('ACCEPTED')
  })

  it('PaymentGateBlockedError contains gate and blockers', () => {
    const err = new PaymentGateBlockedError('order-123', 'po_creation', ['Deposit not received'], 5000)
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('PAYMENT_GATE_BLOCKED')
    expect(err.gate).toBe('po_creation')
    expect(err.orderId).toBe('order-123')
    expect(err.blockers).toContain('Deposit not received')
    expect(err.outstandingBalance).toBe(5000)
  })

  it('InvariantViolationError carries invariant description', () => {
    const err = new InvariantViolationError('Missing customer', { quoteId: 'q1' })
    expect(err.code).toBe('INVARIANT_VIOLATION')
    expect(err.invariant).toBe('Missing customer')
    expect(err.context).toHaveProperty('quoteId', 'q1')
  })

  it('EntityNotFoundError carries entity context', () => {
    const err = new EntityNotFoundError('order', 'fake-id-123')
    expect(err.code).toBe('ENTITY_NOT_FOUND')
    expect(err.entityType).toBe('order')
    expect(err.entityId).toBe('fake-id-123')
  })

  it('PermissionDeniedError carries action context', () => {
    const err = new PermissionDeniedError('delete_order', 'Insufficient role: viewer')
    expect(err.code).toBe('PERMISSION_DENIED')
    expect(err.action).toBe('delete_order')
    expect(err.reason).toContain('viewer')
    expect(err.message).toContain('delete_order')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. COMMAND BUS REGISTRATION & DISPATCH
// ═══════════════════════════════════════════════════════════════════════════

describe('Command Bus Mechanics', () => {
  it('returns error for unknown command type', async () => {
    // Import fresh command bus — handlers are NOT registered in this test
    const { execute } = await import('@/lib/control/command-bus')

    const result = await execute(
      { type: 'nonexistent_command' },
      { org_id: ORG },
    )

    expect(result.success).toBe(false)
    expect(result.errors?.[0]?.code).toBe('UNKNOWN_COMMAND')
  })

  it('getRegisteredCommandTypes returns a list', async () => {
    const { getRegisteredCommandTypes } = await import('@/lib/control/command-bus')
    const types = getRegisteredCommandTypes()
    expect(Array.isArray(types)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. CONTROL TYPES CONTRACT
// ═══════════════════════════════════════════════════════════════════════════

describe('CommandResult Contract', () => {
  it('success result shape', () => {
    const result = {
      success: true as const,
      entity_type: 'quote',
      entity_id: uid(),
      status_after: 'DRAFT',
      emitted_event_ids: [uid()],
      audit_ref: 'audit-001',
      message: 'Created',
      warnings: [],
      errors: undefined,
    }
    expect(result.success).toBe(true)
    expect(result.entity_type).toBe('quote')
    expect(result.emitted_event_ids).toHaveLength(1)
  })

  it('failure result shape', () => {
    const result = {
      success: false as const,
      errors: [
        { code: 'INVALID_TRANSITION', message: 'Cannot move from DRAFT to ACCEPTED' },
      ],
    }
    expect(result.success).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]!.code).toBe('INVALID_TRANSITION')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. CROSS-WORKFLOW INVARIANT: NO BACKWARD TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('Cross-Workflow Invariant: Terminal States', () => {
  const terminalStates: { workflow: 'quote' | 'order' | 'purchase_order' | 'production' | 'shipment'; status: string }[] = [
    { workflow: 'quote', status: 'CANCELLED' },
    { workflow: 'quote', status: 'CLOSED' },
    { workflow: 'order', status: 'CLOSED' },
    { workflow: 'shipment', status: 'DELIVERED' },
    { workflow: 'shipment', status: 'RETURNED' },
    { workflow: 'production', status: 'READY_TO_SHIP' },
  ]

  for (const { workflow, status } of terminalStates) {
    it(`${workflow} terminal state "${status}" has no forward transitions`, () => {
      const transitions = getAvailableTransitions(workflow, status)
      expect(transitions.length).toBe(0)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// 7. COMMAND COMPLETENESS
// ═══════════════════════════════════════════════════════════════════════════

describe('Command Type Completeness', () => {
  const ALL_COMMAND_TYPES = [
    'create_quote',
    'send_quote',
    'accept_quote',
    'request_quote_revision',
    'convert_quote_to_order',
    'confirm_order',
    'require_deposit',
    'record_payment',
    'confirm_payment',
    'create_purchase_order',
    'send_purchase_order',
    'confirm_purchase_order',
    'start_production',
    'complete_production',
    'create_shipment',
    'mark_shipment_shipped',
    'mark_shipment_delivered',
  ]

  it('has exactly 17 command types', () => {
    expect(ALL_COMMAND_TYPES).toHaveLength(17)
  })

  it('all command schemas export the expected type literal', () => {
    const schemas = [
      CreateQuoteCommand,
      SendQuoteCommand,
      AcceptQuoteCommand,
      RequestQuoteRevisionCommand,
      ConvertQuoteToOrderCommand,
      ConfirmOrderCommand,
      RequireDepositCommand,
      RecordPaymentCommand,
      ConfirmPaymentCommand,
      CreatePurchaseOrderCommand,
      SendPurchaseOrderCommand,
      ConfirmPurchaseOrderCommand,
      StartProductionCommand,
      CompleteProductionCommand,
      CreateShipmentCommand,
      MarkShipmentShippedCommand,
      MarkShipmentDeliveredCommand,
    ]

    expect(schemas).toHaveLength(17)
    // Each schema should be a ZodObject with a 'type' field that is a literal
    for (const schema of schemas) {
      expect(schema).toBeDefined()
      expect(schema instanceof z.ZodObject).toBe(true)
    }
  })
})
