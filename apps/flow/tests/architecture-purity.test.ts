/**
 * Architecture Purity Tests
 *
 * Validates that server-action files follow the governance rules:
 *   1. Status-changing mutations route through the command bus (executeCommand)
 *   2. Workflow trigger actions never access the DB directly
 *   3. The command bus has all expected handlers registered
 *   4. Shared UX components are exported from the barrel
 *
 * These tests use static source analysis — no DB required.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..')

function readSource(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), 'utf-8')
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. COMMAND BUS ROUTING
// ═══════════════════════════════════════════════════════════════════════════

describe('Command Bus Routing', () => {
  it('orders.ts routes status changes through executeCommand', () => {
    const src = readSource('app/actions/orders.ts')
    expect(src).toContain('executeCommand')
    expect(src).toContain('statusCommandMap')
    // Verify all critical statuses are mapped to command bus types
    for (const mapping of [
      "confirmed: 'confirm_order'",
      "fulfillment: 'start_fulfillment'",
      "shipped: 'ship_order'",
      "delivered: 'mark_order_delivered'",
      "completed: 'complete_order'",
      "cancelled: 'cancel_order'",
    ]) {
      expect(src).toContain(mapping)
    }
  })

  it('payments.ts routes payment recording through executeCommand', () => {
    const src = readSource('app/actions/payments.ts')
    expect(src).toContain('executeCommand')
    expect(src).toContain("'record_payment'")
  })

  it('purchase-orders.ts routes workflow actions through executeCommand', () => {
    const src = readSource('app/actions/purchase-orders.ts')
    expect(src).toContain('executeCommand')
    // All critical PO workflow actions use command bus
    expect(src).toContain("'send_purchase_order'")
    expect(src).toContain("'confirm_purchase_order'")
    expect(src).toContain("'receive_po_line'")
    expect(src).toContain("'cancel_purchase_order'")
  })

  it('workflow-triggers.ts uses only executeCommand (no direct DB)', () => {
    const src = readSource('app/actions/workflow-triggers.ts')
    expect(src).toContain('executeCommand')
    // Should NOT import any direct DB functions
    expect(src).not.toContain("from '@nzila/commerce-db'")
    expect(src).not.toContain('getDbContext')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. HANDLER REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Handler Registration', () => {
  it('register-handlers.ts registers all expected handlers', () => {
    const src = readSource('lib/control/register-handlers.ts')

    const expectedHandlers = [
      'createQuoteHandler',
      'sendQuoteHandler',
      'acceptQuoteHandler',
      'requestQuoteRevisionHandler',
      'convertQuoteToOrderHandler',
      'confirmOrderHandler',
      'startFulfillmentHandler',
      'completeOrderHandler',
      'cancelOrderHandler',
      'requireDepositHandler',
      'recordPaymentHandler',
      'confirmPaymentHandler',
      'createPurchaseOrderHandler',
      'sendPurchaseOrderHandler',
      'confirmPurchaseOrderHandler',
      'startProductionHandler',
      'completeProductionHandler',
      'createShipmentHandler',
      'markShipmentShippedHandler',
      'markShipmentDeliveredHandler',
      'triggerSalesToProcurementHandler',
      'checkProductionReadinessHandler',
      'shipOrderHandler',
      'markOrderDeliveredHandler',
      'receivePOLineHandler',
      'cancelPurchaseOrderHandler',
    ]

    for (const handler of expectedHandlers) {
      expect(src).toContain(handler)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. UX COMPONENT BARREL EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

describe('UX Component Barrel', () => {
  it('index.ts exports all shared dashboard components', () => {
    const src = readSource('app/(dashboard)/components/index.ts')
    expect(src).toContain('StatusBadge')
    expect(src).toContain('LifecycleTimeline')
    expect(src).toContain('SystemGuidance')
    expect(src).toContain('ProgressStepper')
    expect(src).toContain('TimelineEvent')
    expect(src).toContain('Step')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. DETAIL PAGES USE SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Detail Pages Use Shared Components', () => {
  it('order detail page imports shared components', () => {
    const src = readSource('app/(dashboard)/orders/[id]/page.tsx')
    expect(src).toContain('StatusBadge')
    expect(src).toContain('LifecycleTimeline')
    expect(src).toContain('SystemGuidance')
    expect(src).toContain('ProgressStepper')
  })

  it('PO detail page imports shared components', () => {
    const src = readSource('app/(dashboard)/purchase-orders/[id]/page.tsx')
    expect(src).toContain('StatusBadge')
    expect(src).toContain('LifecycleTimeline')
    expect(src).toContain('SystemGuidance')
  })

  it('quote detail page imports shared components', () => {
    const src = readSource('app/(dashboard)/quotes/[id]/page.tsx')
    expect(src).toContain('StatusBadge')
    expect(src).toContain('LifecycleTimeline')
    expect(src).toContain('SystemGuidance')
    expect(src).toContain('ProgressStepper')
  })
})
