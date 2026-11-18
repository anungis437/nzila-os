import { beforeEach, describe, expect, it, vi } from 'vitest'
const transport = vi.hoisted(() => ({ create: vi.fn(), client: vi.fn() }))
vi.mock('../client', () => ({ getStripeClient: transport.client }))
vi.mock('../env', () => ({ getStripeEnv: () => ({ STRIPE_DEFAULT_CURRENCY: 'CAD' }) }))
import { createCustomer, createCheckoutSession, createSubscription, createSubscriptionCheckoutSession } from '../primitives'

type Context = { metadata?: Record<string, string>; ventureId?: string }
const flows = [
  { name: 'customer', invoke: (context: Context) => createCustomer({ email: 'synthetic@example.invalid', name: 'Synthetic', orgId: 'org-a', ...context }) },
  { name: 'payment checkout', invoke: (context: Context) => createCheckoutSession({ orgId: 'org-a', lineItems: [], successUrl: 'https://example.invalid/done', cancelUrl: 'https://example.invalid/cancel', ...context }) },
  { name: 'subscription', invoke: (context: Context) => createSubscription({ orgId: 'org-a', customerId: 'customer-a', priceId: 'price-a', ...context }) },
  { name: 'subscription checkout', invoke: (context: Context) => createSubscriptionCheckoutSession({ orgId: 'org-a', priceId: 'price-a', successUrl: 'https://example.invalid/done', cancelUrl: 'https://example.invalid/cancel', ...context }) },
]

beforeEach(() => {
  vi.clearAllMocks()
  transport.client.mockReturnValue({ customers: { create: transport.create }, checkout: { sessions: { create: transport.create } }, subscriptions: { create: transport.create } })
  transport.create.mockResolvedValue({ id: 'synthetic-provider-object', url: 'https://example.invalid/provider', status: 'incomplete', latest_invoice: null, items: { data: [{ current_period_end: 123 }] } })
})

describe.each(flows)('$name authoritative provider metadata', ({ invoke }) => {
  it.each([
    { label: 'foreign organization', metadata: { org_id: 'org-b' }, ventureId: 'venture-a' },
    { label: 'foreign venture', metadata: { venture_id: 'venture-b' }, ventureId: 'venture-a' },
    { label: 'undeclared venture', metadata: { venture_id: 'venture-b' }, ventureId: undefined },
  ])('rejects $label before obtaining the provider client', async ({ metadata, ventureId }) => {
    await expect(invoke({ metadata, ventureId })).rejects.toThrow('Reserved Stripe metadata conflicts')
    expect(transport.client).not.toHaveBeenCalled()
    expect(transport.create).not.toHaveBeenCalled()
  })

  it('preserves the authoritative organization and custom non-reserved metadata', async () => {
    await invoke({ metadata: { reference: 'case-independent-reference' } })
    const sent = transport.create.mock.calls[0]![0]
    expect(sent.metadata).toEqual({ org_id: 'org-a', reference: 'case-independent-reference' })
    if (sent.subscription_data) expect(sent.subscription_data.metadata).toEqual(sent.metadata)
  })

  it('accepts identical declared scope without changing the downstream scope', async () => {
    await invoke({ ventureId: 'venture-a', metadata: { org_id: 'org-a', venture_id: 'venture-a', reference: 'synthetic' } })
    const sent = transport.create.mock.calls[0]![0]
    expect(sent.metadata).toEqual({ org_id: 'org-a', venture_id: 'venture-a', reference: 'synthetic' })
    if (sent.subscription_data) expect(sent.subscription_data.metadata).toEqual(sent.metadata)
  })
})
