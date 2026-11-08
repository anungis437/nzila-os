import { describe, expect, it, vi } from 'vitest'

const { persistAtomicAudit } = vi.hoisted(() => ({ persistAtomicAudit: vi.fn() }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit }))

import { recordExternalDisclosure } from '../external-disclosure'

describe('recordExternalDisclosure', () => {
  it('records the processor, data classes and purpose, never the raw disclosed values', async () => {
    await recordExternalDisclosure({} as never, {
      organizationId: 'org-1',
      userId: 'user-1',
      processor: 'stripe',
      resourceType: 'dues_transactions',
      resourceId: 'payment-1',
      dataClasses: ['organization_id', 'member_user_id'],
      purpose: 'Union dues payment processing',
      merchantOfRecord: 'platform',
    })

    expect(persistAtomicAudit).toHaveBeenCalledWith(
      {},
      {
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'external_disclosure.stripe',
        resourceType: 'dues_transactions',
        resourceId: 'payment-1',
        details: {
          processor: 'stripe',
          dataClasses: ['organization_id', 'member_user_id'],
          purpose: 'Union dues payment processing',
          merchantOfRecord: 'platform',
        },
      },
    )
  })

  it('defaults userId and resourceId to null and omits merchantOfRecord when not given', async () => {
    await recordExternalDisclosure({} as never, {
      organizationId: 'org-1',
      processor: 'hubspot',
      resourceType: 'pilot_applications',
      dataClasses: ['email', 'phone'],
      purpose: 'CRM lead sync',
    })

    expect(persistAtomicAudit).toHaveBeenCalledWith(
      {},
      {
        organizationId: 'org-1',
        userId: null,
        action: 'external_disclosure.hubspot',
        resourceType: 'pilot_applications',
        resourceId: null,
        details: {
          processor: 'hubspot',
          dataClasses: ['email', 'phone'],
          purpose: 'CRM lead sync',
        },
      },
    )
  })
})
