import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const {
  mockRouterRefresh,
  mockSendPurchaseOrderAction,
  mockAcknowledgePurchaseOrderAction,
  mockReceiveLineAction,
  mockCancelPurchaseOrderAction,
  mockUpdateOrderAction,
  mockCheckProductionReadinessAction,
} = vi.hoisted(() => ({
  mockRouterRefresh: vi.fn(),
  mockSendPurchaseOrderAction: vi.fn(),
  mockAcknowledgePurchaseOrderAction: vi.fn(),
  mockReceiveLineAction: vi.fn(),
  mockCancelPurchaseOrderAction: vi.fn(),
  mockUpdateOrderAction: vi.fn(),
  mockCheckProductionReadinessAction: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}))

vi.mock('@/app/actions/purchase-orders', () => ({
  sendPurchaseOrderAction: mockSendPurchaseOrderAction,
  acknowledgePurchaseOrderAction: mockAcknowledgePurchaseOrderAction,
  receiveLineAction: mockReceiveLineAction,
  cancelPurchaseOrderAction: mockCancelPurchaseOrderAction,
}))

vi.mock('@/app/actions/orders', () => ({
  updateOrderAction: mockUpdateOrderAction,
}))

vi.mock('@/app/actions/workflow-triggers', () => ({
  checkProductionReadinessAction: mockCheckProductionReadinessAction,
}))

describe('dashboard actions slices', () => {
  it('renders PO action branches by status', async () => {
    const { POActions } = await import('@/app/(dashboard)/purchase-orders/[id]/po-actions')

    const draftMarkup = renderToStaticMarkup(
      React.createElement(POActions, {
        poId: 'po-1',
        status: 'draft',
        lines: [{ id: 'line-1', description: 'Widget', quantity: 2, quantityReceived: 0 }],
      }),
    )
    expect(draftMarkup).toContain('Send to Supplier')
    expect(draftMarkup).toContain('Cancel PO')

    const sentMarkup = renderToStaticMarkup(
      React.createElement(POActions, {
        poId: 'po-1',
        status: 'sent',
        lines: [{ id: 'line-1', description: 'Widget', quantity: 2, quantityReceived: 0 }],
      }),
    )
    expect(sentMarkup).toContain('Acknowledge')
    expect(sentMarkup).toContain('Receive Stock')

    const receivedMarkup = renderToStaticMarkup(
      React.createElement(POActions, {
        poId: 'po-1',
        status: 'received',
        lines: [{ id: 'line-1', description: 'Widget', quantity: 2, quantityReceived: 2 }],
      }),
    )
    expect(receivedMarkup).not.toContain('Receive Stock')
  })

  it('renders order action branches by status', async () => {
    const { OrderActions } = await import('@/app/(dashboard)/orders/[id]/order-actions')

    const createdMarkup = renderToStaticMarkup(React.createElement(OrderActions, { orderId: 'ord-1', status: 'created' }))
    expect(createdMarkup).toContain('Confirm Order')
    expect(createdMarkup).toContain('Cancel')

    const confirmedMarkup = renderToStaticMarkup(React.createElement(OrderActions, { orderId: 'ord-1', status: 'confirmed' }))
    expect(confirmedMarkup).toContain('Start Fulfillment')
    expect(confirmedMarkup).toContain('Check Readiness')

    const cancelledMarkup = renderToStaticMarkup(React.createElement(OrderActions, { orderId: 'ord-1', status: 'cancelled' }))
    expect(cancelledMarkup).not.toContain('Cancel')
  })
})
