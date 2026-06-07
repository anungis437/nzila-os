/**
 * @nzila/commerce-integration-tests — Cross-Package Integration Tests
 *
 * Verifies that the commerce engine works correctly when multiple packages
 * are wired together. These tests exercise the full lifecycle:
 *
 *   State Machine + Governance Gates + Events + Audit + Evidence
 *
 * Non-negotiable invariants verified:
 *   - Org isolation: cross-org transitions are rejected at every layer
 *   - Governance gates: governed machines enforce policy thresholds
 *   - Events: successful transitions produce domain events
 *   - Audit: transition results can be converted to audit entries
 *   - Evidence: audit trails integrate with evidence packs
 *   - Sagas: event-driven saga execution with compensation
 *
 * @module @nzila/commerce-integration-tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  QuoteStatus,
  OrderStatus,
  InvoiceStatus,
  OrgRole,
} from '@nzila/commerce-core/enums'
import {
  attemptTransition,
  getAvailableTransitions,
  validateMachine,
  quoteMachine,
  orderMachine,
  invoiceMachine,
} from '@nzila/commerce-state'
import type { TransitionContext, TransitionSuccess } from '@nzila/commerce-state'
import {
  createGovernedQuoteMachine,
  createGovernedOrderMachine,
  createGovernedInvoiceMachine,
  evaluateGates,
  createApprovalRequiredGate,
  createMarginFloorGate,
  createDiscountCapGate,
  createQuoteCompletenessGate,
  resolvePolicy,
} from '@nzila/commerce-governance'
import type {
  QuoteEntity,
  OrderEntity,
  InvoiceEntity,
  GovernancePolicy,
} from '@nzila/commerce-governance'
import {
  InMemoryEventBus,
  createDomainEvent,
  createSagaOrchestrator,
} from '@nzila/commerce-events'
import type { DomainEvent, SagaDefinition, SagaContext as _SagaContext } from '@nzila/commerce-events'
import {
  buildTransitionAuditEntry,
  validateAuditEntry,
  hashAuditEntry,
  summarizeAuditTrail,
  CommerceEntityType,
  AuditAction,
} from '@nzila/commerce-audit'
import type { AuditEntry, TransitionAuditContext } from '@nzila/commerce-audit'
import {
  buildCommerceEvidencePack,
  validateCommerceEvidencePack,
  resetPackCounter,
  buildArtifact,
  toSealableIndex,
  COMMERCE_CONTROL_MAPPINGS,
} from '@nzila/commerce-evidence'
import { EvidenceType } from '@nzila/commerce-core/enums'

// ── Shared Fixtures ─────────────────────────────────────────────────────────

const ORG_A = 'org-alpha'
const ORG_B = 'org-beta'

const ctx = (
  orgId: string = ORG_A,
  role: OrgRole = OrgRole.ADMIN,
  actorId: string = 'actor-001',
): TransitionContext => ({
  orgId,
  actorId,
  role,
  meta: {},
})

function quoteEntity(overrides?: Partial<QuoteEntity>): QuoteEntity {
  return {
    orgId: ORG_A,
    grandTotal: 5_000,
    approvalFlags: [],
    marginPercent: 25,
    discountPercent: 10,
    validUntil: null,
    hasApproval: false,
    lineCount: 3,
    ...overrides,
  }
}

function orderEntity(overrides?: Partial<OrderEntity>): OrderEntity {
  return {
    orgId: ORG_A,
    grandTotal: 5_000,
    lineCount: 3,
    quoteSnapshotHash: 'sha256-abc123',
    ...overrides,
  }
}

function invoiceEntity(overrides?: Partial<InvoiceEntity>): InvoiceEntity {
  return {
    orgId: ORG_A,
    grandTotal: 5_000,
    hasEvidencePack: true,
    lineCount: 3,
    ...overrides,
  }
}

function makeAuditCtx(
  entityType: CommerceEntityType = CommerceEntityType.QUOTE,
  targetEntityId: string = 'q-1',
  orgId: string = ORG_A,
): TransitionAuditContext {
  return {
    id: crypto.randomUUID(),
    orgId,
    actorId: 'actor-001',
    role: OrgRole.ADMIN,
    entityType,
    targetEntityId,
    timestamp: '2026-01-15T10:00:00Z',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. ORG ISOLATION — Cross-Org Rejection at Every Layer
// ═══════════════════════════════════════════════════════════════════════════

describe('Org Isolation — cross-org rejection', () => {
  describe('state engine rejects cross-org transitions', () => {
    it('quote: Org A actor cannot transition Org B resource', () => {
      const result = attemptTransition(
        quoteMachine,
        QuoteStatus.DRAFT,
        QuoteStatus.PRICING,
        ctx(ORG_A),
        ORG_B,
        {},
      )
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('ORG_MISMATCH')
    })

    it('order: Org A actor cannot transition Org B resource', () => {
      const result = attemptTransition(
        orderMachine,
        OrderStatus.CREATED,
        OrderStatus.CONFIRMED,
        ctx(ORG_A, OrgRole.SALES),
        ORG_B,
        {},
      )
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('ORG_MISMATCH')
    })

    it('invoice: Org A actor cannot transition Org B resource', () => {
      const result = attemptTransition(
        invoiceMachine,
        InvoiceStatus.DRAFT,
        InvoiceStatus.ISSUED,
        ctx(ORG_A, OrgRole.FINANCE),
        ORG_B,
        {},
      )
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('ORG_MISMATCH')
    })
  })

  describe('governed machines also reject cross-org transitions', () => {
    it('governed quote machine rejects cross-org', () => {
      const governed = createGovernedQuoteMachine(quoteMachine)
      const result = attemptTransition(
        governed,
        QuoteStatus.DRAFT,
        QuoteStatus.PRICING,
        ctx(ORG_A),
        ORG_B,
        quoteEntity(),
      )
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('ORG_MISMATCH')
    })

    it('governed order machine rejects cross-org', () => {
      const governed = createGovernedOrderMachine(orderMachine)
      const result = attemptTransition(
        governed,
        OrderStatus.CREATED,
        OrderStatus.CONFIRMED,
        ctx(ORG_A, OrgRole.SALES),
        ORG_B,
        orderEntity(),
      )
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('ORG_MISMATCH')
    })

    it('governed invoice machine rejects cross-org', () => {
      const governed = createGovernedInvoiceMachine(invoiceMachine)
      const result = attemptTransition(
        governed,
        InvoiceStatus.DRAFT,
        InvoiceStatus.ISSUED,
        ctx(ORG_A, OrgRole.FINANCE),
        ORG_B,
        invoiceEntity(),
      )
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('ORG_MISMATCH')
    })
  })

  describe('getAvailableTransitions returns empty for cross-org', () => {
    it('base quote machine returns no transitions for wrong org', () => {
      const avail = getAvailableTransitions(quoteMachine, QuoteStatus.DRAFT, ctx(ORG_A), ORG_B, {})
      expect(avail).toEqual([])
    })

    it('governed order machine returns no transitions for wrong org', () => {
      const governed = createGovernedOrderMachine(orderMachine)
      const avail = getAvailableTransitions(governed, OrderStatus.CREATED, ctx(ORG_A, OrgRole.SALES), ORG_B, orderEntity())
      expect(avail).toEqual([])
    })
  })

  describe('audit entries are org-scoped', () => {
    it('audit entry orgId always matches transition context', () => {
      const result = attemptTransition(
        quoteMachine,
        QuoteStatus.DRAFT,
        QuoteStatus.PRICING,
        ctx(ORG_A),
        ORG_A,
        {},
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return

      const auditCtx = makeAuditCtx(CommerceEntityType.QUOTE, 'q-1', ORG_A)
      const entry = buildTransitionAuditEntry(result, auditCtx)
      expect(entry.orgId).toBe(ORG_A)
      expect(entry.actorId).toBe('actor-001')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. GOVERNED MACHINE LIFECYCLE — Full Transition Sequences
// ═══════════════════════════════════════════════════════════════════════════

describe('Governed Machine Lifecycle — quote', () => {
  const governed = createGovernedQuoteMachine(quoteMachine)

  it('happy path: draft → pricing → ready → sent (within policy)', () => {
    const entity = quoteEntity({ marginPercent: 25, discountPercent: 5, lineCount: 2 })

    const r1 = attemptTransition(governed, QuoteStatus.DRAFT, QuoteStatus.PRICING, ctx(ORG_A, OrgRole.SALES), ORG_A, entity)
    expect(r1.ok).toBe(true)

    const r2 = attemptTransition(governed, QuoteStatus.PRICING, QuoteStatus.READY, ctx(ORG_A, OrgRole.SALES), ORG_A, entity)
    expect(r2.ok).toBe(true)

    const r3 = attemptTransition(governed, QuoteStatus.READY, QuoteStatus.SENT, ctx(ORG_A, OrgRole.SALES), ORG_A, entity)
    expect(r3.ok).toBe(true)
  })

  it('blocks acceptance when above threshold without approval', () => {
    const entity = quoteEntity({ grandTotal: 15_000, hasApproval: false })
    const result = attemptTransition(governed, QuoteStatus.SENT, QuoteStatus.ACCEPTED, ctx(ORG_A), ORG_A, entity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('GUARD_FAILED')
  })

  it('allows acceptance when above threshold WITH approval', () => {
    const entity = quoteEntity({ grandTotal: 15_000, hasApproval: true })
    const result = attemptTransition(governed, QuoteStatus.SENT, QuoteStatus.ACCEPTED, ctx(ORG_A), ORG_A, entity)
    expect(result.ok).toBe(true)
  })

  it('blocks pricing → ready when margin below floor', () => {
    const entity = quoteEntity({ marginPercent: 10 })
    const result = attemptTransition(governed, QuoteStatus.PRICING, QuoteStatus.READY, ctx(ORG_A, OrgRole.SALES), ORG_A, entity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('GUARD_FAILED')
  })

  it('blocks send when quote has zero lines', () => {
    const entity = quoteEntity({ lineCount: 0, marginPercent: 25 })
    const result = attemptTransition(governed, QuoteStatus.READY, QuoteStatus.SENT, ctx(ORG_A, OrgRole.SALES), ORG_A, entity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('GUARD_FAILED')
  })

  it('blocks high-discount without elevated role', () => {
    const entity = quoteEntity({ discountPercent: 30 })
    const result = attemptTransition(governed, QuoteStatus.DRAFT, QuoteStatus.PRICING, ctx(ORG_A, OrgRole.SALES), ORG_A, entity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('GUARD_FAILED')
  })

  it('allows high-discount for elevated role (manager)', () => {
    const entity = quoteEntity({ discountPercent: 30 })
    const result = attemptTransition(governed, QuoteStatus.DRAFT, QuoteStatus.PRICING, ctx(ORG_A, OrgRole.MANAGER), ORG_A, entity)
    expect(result.ok).toBe(true)
  })
})

describe('Governed Machine Lifecycle — order', () => {
  const governed = createGovernedOrderMachine(orderMachine)

  it('happy path: created → confirmed with valid entity', () => {
    const entity = orderEntity({ lineCount: 3, quoteSnapshotHash: 'sha256-abc' })
    const result = attemptTransition(governed, OrderStatus.CREATED, OrderStatus.CONFIRMED, ctx(ORG_A, OrgRole.SALES), ORG_A, entity)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.eventsToEmit.some(e => e.type === 'order.confirmed')).toBe(true)
      expect(result.actionsToSchedule.some(a => a.type === 'create_invoice_from_order')).toBe(true)
    }
  })

  it('blocks confirmation when zero lines', () => {
    const entity = orderEntity({ lineCount: 0 })
    const result = attemptTransition(governed, OrderStatus.CREATED, OrderStatus.CONFIRMED, ctx(ORG_A, OrgRole.SALES), ORG_A, entity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('GUARD_FAILED')
  })

  it('blocks confirmation without snapshot hash', () => {
    const entity = orderEntity({ quoteSnapshotHash: null })
    const result = attemptTransition(governed, OrderStatus.CREATED, OrderStatus.CONFIRMED, ctx(ORG_A, OrgRole.SALES), ORG_A, entity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('GUARD_FAILED')
  })

  it('blocks high-value order for non-elevated role', () => {
    const entity = orderEntity({ grandTotal: 60_000 })
    const result = attemptTransition(governed, OrderStatus.CREATED, OrderStatus.CONFIRMED, ctx(ORG_A, OrgRole.SALES), ORG_A, entity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('GUARD_FAILED')
  })

  it('allows high-value order for elevated role', () => {
    const entity = orderEntity({ grandTotal: 60_000 })
    const result = attemptTransition(governed, OrderStatus.CREATED, OrderStatus.CONFIRMED, ctx(ORG_A, OrgRole.ADMIN), ORG_A, entity)
    expect(result.ok).toBe(true)
  })
})

describe('Governed Machine Lifecycle — invoice', () => {
  const governed = createGovernedInvoiceMachine(invoiceMachine)

  it('happy path: draft → issued with evidence and lines', () => {
    const entity = invoiceEntity({ hasEvidencePack: true, lineCount: 2 })
    const result = attemptTransition(governed, InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, ctx(ORG_A, OrgRole.FINANCE), ORG_A, entity)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.eventsToEmit.some(e => e.type === 'invoice.issued')).toBe(true)
    }
  })

  it('blocks issuance without evidence pack', () => {
    const entity = invoiceEntity({ hasEvidencePack: false })
    const result = attemptTransition(governed, InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, ctx(ORG_A, OrgRole.FINANCE), ORG_A, entity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('GUARD_FAILED')
  })

  it('blocks issuance with zero lines', () => {
    const entity = invoiceEntity({ lineCount: 0 })
    const result = attemptTransition(governed, InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, ctx(ORG_A, OrgRole.FINANCE), ORG_A, entity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('GUARD_FAILED')
  })

  it('allows issuance when evidence not required by policy', () => {
    const governed2 = createGovernedInvoiceMachine(invoiceMachine, { requireEvidenceForInvoice: false })
    const entity = invoiceEntity({ hasEvidencePack: false })
    const result = attemptTransition(governed2, InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, ctx(ORG_A, OrgRole.FINANCE), ORG_A, entity)
    expect(result.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. STATE MACHINE INTEGRATION — Illegal Transitions & Timeouts
// ═══════════════════════════════════════════════════════════════════════════

describe('State Machine Integration — illegal transitions', () => {
  const governed = createGovernedQuoteMachine(quoteMachine)
  const entity = quoteEntity()

  it('cannot skip states: draft → sent directly', () => {
    const result = attemptTransition(governed, QuoteStatus.DRAFT, QuoteStatus.SENT, ctx(ORG_A, OrgRole.SALES), ORG_A, entity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INVALID_TRANSITION')
  })

  it('cannot skip states: draft → accepted directly', () => {
    const result = attemptTransition(governed, QuoteStatus.DRAFT, QuoteStatus.ACCEPTED, ctx(ORG_A), ORG_A, entity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INVALID_TRANSITION')
  })

  it('cannot transition from terminal state (accepted)', () => {
    const result = attemptTransition(governed, QuoteStatus.ACCEPTED, QuoteStatus.DRAFT, ctx(ORG_A), ORG_A, entity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('TERMINAL_STATE')
  })

  it('cannot transition from terminal state (cancelled)', () => {
    const result = attemptTransition(governed, QuoteStatus.CANCELLED, QuoteStatus.DRAFT, ctx(ORG_A), ORG_A, entity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('TERMINAL_STATE')
  })

  it('order: cannot go completed → anything', () => {
    const govOrder = createGovernedOrderMachine(orderMachine)
    const result = attemptTransition(govOrder, OrderStatus.COMPLETED, OrderStatus.CONFIRMED, ctx(ORG_A), ORG_A, orderEntity())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('TERMINAL_STATE')
  })

  it('invoice: cannot go paid → anything', () => {
    const govInvoice = createGovernedInvoiceMachine(invoiceMachine)
    const result = attemptTransition(govInvoice, InvoiceStatus.PAID, InvoiceStatus.SENT, ctx(ORG_A, OrgRole.FINANCE), ORG_A, invoiceEntity())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('TERMINAL_STATE')
  })
})

describe('State Machine Integration — role enforcement', () => {
  const governed = createGovernedQuoteMachine(quoteMachine)
  const entity = quoteEntity()

  it('viewer cannot submit quote for pricing', () => {
    const result = attemptTransition(governed, QuoteStatus.DRAFT, QuoteStatus.PRICING, ctx(ORG_A, OrgRole.VIEWER), ORG_A, entity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ROLE_DENIED')
  })

  it('sales can submit quote for pricing', () => {
    const result = attemptTransition(governed, QuoteStatus.DRAFT, QuoteStatus.PRICING, ctx(ORG_A, OrgRole.SALES), ORG_A, entity)
    expect(result.ok).toBe(true)
  })

  it('warehouse cannot confirm order', () => {
    const govOrder = createGovernedOrderMachine(orderMachine)
    const oEntity = orderEntity()
    const result = attemptTransition(govOrder, OrderStatus.CREATED, OrderStatus.CONFIRMED, ctx(ORG_A, OrgRole.WAREHOUSE), ORG_A, oEntity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ROLE_DENIED')
  })

  it('sales cannot issue invoice (finance required)', () => {
    const govInvoice = createGovernedInvoiceMachine(invoiceMachine)
    const iEntity = invoiceEntity()
    const result = attemptTransition(govInvoice, InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, ctx(ORG_A, OrgRole.SALES), ORG_A, iEntity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ROLE_DENIED')
  })
})

describe('State Machine Integration — timeout annotations', () => {
  it('quote sent → expired has timeout definition', () => {
    const sentToExpired = quoteMachine.transitions.find(
      t => t.from === QuoteStatus.SENT && t.to === QuoteStatus.EXPIRED,
    )
    expect(sentToExpired).toBeDefined()
    expect(sentToExpired!.timeout).toBeDefined()
    expect(sentToExpired!.timeout!.delayMs).toBe(30 * 24 * 60 * 60 * 1000)
    expect(sentToExpired!.timeout!.targetState).toBe(QuoteStatus.EXPIRED)
  })

  it('invoice sent → overdue has timeout definition', () => {
    const sentToOverdue = invoiceMachine.transitions.find(
      t => t.from === InvoiceStatus.SENT && t.to === InvoiceStatus.OVERDUE,
    )
    expect(sentToOverdue).toBeDefined()
    expect(sentToOverdue!.timeout).toBeDefined()
    expect(sentToOverdue!.timeout!.delayMs).toBe(30 * 24 * 60 * 60 * 1000)
    expect(sentToOverdue!.timeout!.targetState).toBe(InvoiceStatus.OVERDUE)
  })

  it('timeout is propagated in transition result', () => {
    const result = attemptTransition(
      invoiceMachine,
      InvoiceStatus.SENT,
      InvoiceStatus.OVERDUE,
      ctx(ORG_A),
      ORG_A,
      {},
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.timeout).toBeDefined()
      expect(result.timeout!.targetState).toBe(InvoiceStatus.OVERDUE)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. TRANSITION + AUDIT + EVENT INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Transition → Audit → Event pipeline', () => {
  it('successful transition produces valid audit entry', () => {
    const result = attemptTransition(
      quoteMachine,
      QuoteStatus.DRAFT,
      QuoteStatus.PRICING,
      ctx(ORG_A, OrgRole.SALES),
      ORG_A,
      {},
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const entry = buildTransitionAuditEntry(result, makeAuditCtx())
    const errors = validateAuditEntry(entry)
    expect(errors).toEqual([])
    expect(entry.action).toBe(AuditAction.STATE_TRANSITION)
    expect(entry.fromState).toBe(QuoteStatus.DRAFT)
    expect(entry.toState).toBe(QuoteStatus.PRICING)
  })

  it('audit entry can be hashed and the hash is stable', () => {
    const result = attemptTransition(
      quoteMachine,
      QuoteStatus.READY,
      QuoteStatus.SENT,
      ctx(ORG_A, OrgRole.SALES),
      ORG_A,
      {},
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const entry = buildTransitionAuditEntry(result, makeAuditCtx())
    const hash1 = hashAuditEntry(entry)
    const hash2 = hashAuditEntry(entry)
    expect(hash1).toBe(hash2)
    expect(hash1.length).toBeGreaterThan(0)
  })

  it('multiple transitions build a summarizable audit trail', () => {
    const transitions: TransitionSuccess<QuoteStatus>[] = []

    const r1 = attemptTransition(quoteMachine, QuoteStatus.DRAFT, QuoteStatus.PRICING, ctx(ORG_A, OrgRole.SALES), ORG_A, {})
    if (r1.ok) transitions.push(r1)

    const r2 = attemptTransition(quoteMachine, QuoteStatus.PRICING, QuoteStatus.READY, ctx(ORG_A, OrgRole.SALES), ORG_A, {})
    if (r2.ok) transitions.push(r2)

    const r3 = attemptTransition(quoteMachine, QuoteStatus.READY, QuoteStatus.SENT, ctx(ORG_A, OrgRole.SALES), ORG_A, {})
    if (r3.ok) transitions.push(r3)

    expect(transitions).toHaveLength(3)

    const entries = transitions.map((t, i) =>
      buildTransitionAuditEntry(t, { ...makeAuditCtx(), id: `audit-${i}` }),
    )

    const summary = summarizeAuditTrail(entries)
    expect(summary.entryCount).toBe(3)
    expect(summary.actions).toContain(AuditAction.STATE_TRANSITION)
  })

  it('governed transition events match audit eventsEmitted', () => {
    const governed = createGovernedQuoteMachine(quoteMachine)
    const entity = quoteEntity({ marginPercent: 30 })
    const result = attemptTransition(governed, QuoteStatus.PRICING, QuoteStatus.READY, ctx(ORG_A, OrgRole.SALES), ORG_A, entity)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const entry = buildTransitionAuditEntry(result, makeAuditCtx())
    // Events in audit entry must match events from transition result
    expect(entry.eventsEmitted).toEqual(result.eventsToEmit.map(e => e.type))
    // Actions in audit entry must match actions from transition result
    expect(entry.actionsScheduled).toEqual(result.actionsToSchedule.map(a => a.type))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. AUDIT + EVIDENCE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Audit + Evidence integration', () => {
  beforeEach(() => resetPackCounter())

  it('audit trail can be packaged into an evidence pack', () => {
    // Build some audit entries
    const r1 = attemptTransition(quoteMachine, QuoteStatus.DRAFT, QuoteStatus.PRICING, ctx(ORG_A, OrgRole.SALES), ORG_A, {})
    const r2 = attemptTransition(quoteMachine, QuoteStatus.PRICING, QuoteStatus.READY, ctx(ORG_A, OrgRole.SALES), ORG_A, {})
    expect(r1.ok && r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return

    const entries: AuditEntry[] = [
      buildTransitionAuditEntry(r1, { ...makeAuditCtx(), id: 'a-1' }),
      buildTransitionAuditEntry(r2, { ...makeAuditCtx(), id: 'a-2' }),
    ]

    const artifact = buildArtifact(EvidenceType.APPROVAL_RECORD, {
      artifactId: 'art-audit-trail-1',
      filename: 'quote-audit-trail.json',
      contentType: 'application/json',
      sha256: 'sha256-placeholder',
      sizeBytes: 1024,
      description: 'Quote lifecycle audit trail',
    })

    const pack = buildCommerceEvidencePack({
      orgId: ORG_A,
      commerceEntityType: 'quote',
      commerceEntityId: 'q-1',
      createdBy: 'actor-001',
      summary: 'Quote Q-1 lifecycle evidence',
      timestamp: '2026-01-15T10:00:00Z',
    }, [artifact], entries)

    expect(pack.orgId).toBe(ORG_A)
    expect(pack.artifacts).toHaveLength(1)
    expect(pack.auditTrailEntries).toHaveLength(2)

    const errors = validateCommerceEvidencePack(pack)
    expect(errors).toEqual([])
  })

  it('evidence pack includes sealable index for immutability', () => {
    const r1 = attemptTransition(quoteMachine, QuoteStatus.DRAFT, QuoteStatus.PRICING, ctx(ORG_A, OrgRole.SALES), ORG_A, {})
    if (!r1.ok) return

    const entries = [buildTransitionAuditEntry(r1, { ...makeAuditCtx(), id: 'a-seal' })]
    const artifact = buildArtifact(EvidenceType.APPROVAL_RECORD, {
      artifactId: 'art-seal-1',
      filename: 'trail.json',
      contentType: 'application/json',
      sha256: 'sha256-test',
      sizeBytes: 512,
      description: 'test',
    })

    const pack = buildCommerceEvidencePack({
      orgId: ORG_A,
      commerceEntityType: 'quote',
      commerceEntityId: 'q-1',
      createdBy: 'actor-001',
      timestamp: '2026-01-15T10:00:00Z',
    }, [artifact], entries)

    const sealable = toSealableIndex(pack)
    expect(sealable).toBeDefined()
    expect(sealable.packId).toBe(pack.packId)
    expect(sealable.artifacts).toHaveLength(1)
  })

  it('COMMERCE_CONTROL_MAPPINGS has entries for core entity types', () => {
    expect(COMMERCE_CONTROL_MAPPINGS).toBeDefined()
    const types = Object.keys(COMMERCE_CONTROL_MAPPINGS)
    expect(types.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. GOVERNANCE GATE DIAGNOSTICS — evaluateGates across packages
// ═══════════════════════════════════════════════════════════════════════════

describe('Governance Gate Diagnostics — evaluateGates', () => {
  it('reports all gate results for a quote acceptance attempt', () => {
    const _policy = resolvePolicy()
    const gates = [
      { name: 'approval-required', guard: createApprovalRequiredGate() },
      { name: 'discount-cap', guard: createDiscountCapGate() },
      { name: 'quote-completeness', guard: createQuoteCompletenessGate() },
    ]

    // Entity that will FAIL approval (above threshold, no approval)
    const entity = quoteEntity({ grandTotal: 15_000, hasApproval: false, lineCount: 3 })
    const results = evaluateGates(
      gates,
      ctx(ORG_A),
      entity,
      QuoteStatus.SENT,
      QuoteStatus.ACCEPTED,
    )

    expect(results).toHaveLength(3)

    const approvalResult = results.find(r => r.gate === 'approval-required')!
    expect(approvalResult.passed).toBe(false)
    expect(approvalResult.reason).toContain('blocked')

    const discountResult = results.find(r => r.gate === 'discount-cap')!
    expect(discountResult.passed).toBe(true)

    const completenessResult = results.find(r => r.gate === 'quote-completeness')!
    expect(completenessResult.passed).toBe(true)
  })

  it('all gates pass when entity meets all policy thresholds', () => {
    const gates = [
      { name: 'approval-required', guard: createApprovalRequiredGate() },
      { name: 'margin-floor', guard: createMarginFloorGate() },
      { name: 'discount-cap', guard: createDiscountCapGate() },
    ]

    const entity = quoteEntity({ grandTotal: 5_000, marginPercent: 25, discountPercent: 5 })
    const results = evaluateGates(
      gates,
      ctx(ORG_A, OrgRole.ADMIN),
      entity,
      QuoteStatus.PRICING,
      QuoteStatus.READY,
    )

    expect(results.every(r => r.passed)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 7. EVENT BUS + SAGA INTEGRATION — Domain Events drive Saga Execution
// ═══════════════════════════════════════════════════════════════════════════

describe('Event Bus + Saga integration', () => {
  let bus: InMemoryEventBus

  beforeEach(() => {
    bus = new InMemoryEventBus()
  })

  it('transition events can be emitted on the bus', async () => {
    const result = attemptTransition(
      quoteMachine,
      QuoteStatus.SENT,
      QuoteStatus.ACCEPTED,
      ctx(ORG_A),
      ORG_A,
      {},
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const received: DomainEvent[] = []
    bus.on('quote.accepted', (event) => { received.push(event) })

    for (const evt of result.eventsToEmit) {
      const domainEvent = createDomainEvent(evt.type, evt.payload, {
        orgId: ORG_A,
        actorId: 'actor-001',
        correlationId: 'corr-1',
      })
      await bus.emitAndWait(domainEvent)
    }

    expect(received.length).toBeGreaterThanOrEqual(1)
    expect(received.some(e => e.type === 'quote.accepted')).toBe(true)
    expect(received[0]!.metadata.orgId).toBe(ORG_A)
  })

  it('saga orchestrator tracks execution history', async () => {
    const orchestrator = createSagaOrchestrator(bus)

    // Create a minimal test saga
    const testSaga: SagaDefinition<{ value: string }> = {
      name: 'test-integration-saga',
      triggerEvent: 'test.started',
      steps: [
        {
          name: 'step-1',
          execute: async () => ({ ok: true as const, data: undefined }),
          compensate: async () => ({ ok: true as const, data: undefined }),
        },
        {
          name: 'step-2',
          execute: async () => ({ ok: true as const, data: undefined }),
          compensate: async () => ({ ok: true as const, data: undefined }),
        },
      ],
    }

    orchestrator.register(testSaga)
    expect(orchestrator.registeredSagas()).toContain('test-integration-saga')

    const event = createDomainEvent(
      'test.started',
      { value: 'hello' },
      { orgId: ORG_A, actorId: 'actor-001', correlationId: 'c-1' },
    )
    await bus.emitAndWait(event)

    const executions = orchestrator.executions()
    expect(executions).toHaveLength(1)
    expect(executions[0]!.status).toBe('completed')
    expect(executions[0]!.stepsCompleted).toEqual(['step-1', 'step-2'])
  })

  it('saga compensation triggers in reverse order on step failure', async () => {
    const compensated: string[] = []
    const orchestrator = createSagaOrchestrator(bus)

    const failingSaga: SagaDefinition<{ v: string }> = {
      name: 'failing-saga',
      triggerEvent: 'fail.trigger',
      steps: [
        {
          name: 'step-a',
          execute: async () => ({ ok: true as const, data: undefined }),
          compensate: async () => { compensated.push('step-a'); return { ok: true as const, data: undefined } },
        },
        {
          name: 'step-b',
          execute: async () => ({ ok: true as const, data: undefined }),
          compensate: async () => { compensated.push('step-b'); return { ok: true as const, data: undefined } },
        },
        {
          name: 'step-c',
          execute: async () => ({ ok: false as const, error: 'step-c failed' }),
          compensate: async () => { compensated.push('step-c'); return { ok: true as const, data: undefined } },
        },
      ],
    }

    orchestrator.register(failingSaga)

    const event = createDomainEvent(
      'fail.trigger',
      { v: 'test' },
      { orgId: ORG_A, actorId: 'actor-001', correlationId: 'c-fail' },
    )
    await bus.emitAndWait(event)

    const exec = orchestrator.executions()[0]!
    expect(exec.status).toBe('compensated')
    expect(exec.stepsCompleted).toEqual(['step-a', 'step-b'])
    // Compensation is in reverse order
    expect(compensated).toEqual(['step-b', 'step-a'])
    expect(exec.error).toContain('step-c')
  })

  it('saga carries org context (orgId) through execution', async () => {
    const orchestrator = createSagaOrchestrator(bus)
    let capturedEntityId = ''

    const orgSaga: SagaDefinition<Record<string, unknown>> = {
      name: 'org-saga',
      triggerEvent: 'org.test',
      steps: [
        {
          name: 'capture-org',
          execute: async (sagaCtx) => {
            capturedEntityId = sagaCtx.orgId
            return { ok: true as const, data: undefined }
          },
          compensate: async () => ({ ok: true as const, data: undefined }),
        },
      ],
    }

    orchestrator.register(orgSaga)

    const event = createDomainEvent(
      'org.test',
      {},
      { orgId: ORG_B, actorId: 'actor-B', correlationId: 'c-org' },
    )
    await bus.emitAndWait(event)

    expect(capturedEntityId).toBe(ORG_B)
    const exec = orchestrator.executions()[0]!
    expect(exec.orgId).toBe(ORG_B)
  })

  it('compensation continues even when a compensate step throws', async () => {
    const compensated: string[] = []
    const orchestrator = createSagaOrchestrator(bus)

    const saga: SagaDefinition<Record<string, unknown>> = {
      name: 'comp-failure-saga',
      triggerEvent: 'comp.fail',
      steps: [
        {
          name: 'first',
          execute: async () => ({ ok: true as const, data: undefined }),
          compensate: async () => { compensated.push('first'); return { ok: true as const, data: undefined } },
        },
        {
          name: 'second',
          execute: async () => ({ ok: true as const, data: undefined }),
          compensate: async () => { throw new Error('compensation blew up') },
        },
        {
          name: 'third',
          execute: async () => ({ ok: false as const, error: 'boom' }),
          compensate: async () => ({ ok: true as const, data: undefined }),
        },
      ],
    }

    orchestrator.register(saga)
    const event = createDomainEvent('comp.fail', {}, {
      orgId: ORG_A, actorId: 'a', correlationId: 'c',
    })
    await bus.emitAndWait(event)

    const exec = orchestrator.executions()[0]!
    // second's compensation failed, so status should be 'failed' (not fully compensated)
    expect(exec.status).toBe('failed')
    // first was still compensated despite second failing
    expect(compensated).toContain('first')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 8. MACHINE VALIDATION — All governed machines are structurally sound
// ═══════════════════════════════════════════════════════════════════════════

describe('Governed Machine Validation — structural soundness', () => {
  it('governed quote machine passes validateMachine', () => {
    const governed = createGovernedQuoteMachine(quoteMachine)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errors = validateMachine(governed as unknown)
    expect(errors).toEqual([])
  })

  it('governed order machine passes validateMachine', () => {
    const governed = createGovernedOrderMachine(orderMachine)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errors = validateMachine(governed as unknown)
    expect(errors).toEqual([])
  })

  it('governed invoice machine passes validateMachine', () => {
    const governed = createGovernedInvoiceMachine(invoiceMachine)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errors = validateMachine(governed as unknown)
    expect(errors).toEqual([])
  })

  it('withGovernanceGates does not mutate original machine', () => {
    const originalTransitionCount = quoteMachine.transitions.length
    const originalGuardCounts = quoteMachine.transitions.map(t => t.guards.length)

    createGovernedQuoteMachine(quoteMachine)

    expect(quoteMachine.transitions.length).toBe(originalTransitionCount)
    quoteMachine.transitions.forEach((t, i) => {
      expect(t.guards.length).toBe(originalGuardCounts[i])
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 9. CUSTOM POLICY OVERRIDE — per-org policy customization
// ═══════════════════════════════════════════════════════════════════════════

describe('Custom Policy Override — per-org configuration', () => {
  it('custom policy with lower approval threshold blocks lower amounts', () => {
    const strictPolicy: Partial<GovernancePolicy> = { approvalThreshold: 1_000 }
    const governed = createGovernedQuoteMachine(quoteMachine, strictPolicy)

    const entity = quoteEntity({ grandTotal: 2_000, hasApproval: false })
    const result = attemptTransition(governed, QuoteStatus.SENT, QuoteStatus.ACCEPTED, ctx(ORG_A), ORG_A, entity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('GUARD_FAILED')
  })

  it('custom policy with higher margin floor blocks lower margins', () => {
    const strictPolicy: Partial<GovernancePolicy> = { marginFloorPercent: 30 }
    const governed = createGovernedQuoteMachine(quoteMachine, strictPolicy)

    const entity = quoteEntity({ marginPercent: 25 })
    const result = attemptTransition(governed, QuoteStatus.PRICING, QuoteStatus.READY, ctx(ORG_A, OrgRole.SALES), ORG_A, entity)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('GUARD_FAILED')
  })

  it('resolvePolicy fills defaults for unspecified fields', () => {
    const partial: Partial<GovernancePolicy> = { approvalThreshold: 5_000 }
    const resolved = resolvePolicy(partial)
    expect(resolved.approvalThreshold).toBe(5_000)
    expect(resolved.marginFloorPercent).toBe(15) // default
    expect(resolved.highValueThreshold).toBe(50_000) // default
  })
})
