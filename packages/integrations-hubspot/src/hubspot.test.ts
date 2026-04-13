import { describe, it, expect } from 'vitest'
import {
  mapHubspotStageToCaseStatus,
  mapCaseStatusToHubspotStage,
  HUBSPOT_STAGE_TO_CASE_STATUS,
  CASE_STATUS_TO_HUBSPOT_STAGE,
} from './stage-mapping'
import {
  syncHubspotContact,
  hubspotContactSchema,
} from './contacts'
import type { HubspotClient } from './contacts'
import { syncHubspotDeal } from './deals'
import type { HubspotDealsClient } from './deals'
import {
  ingestHubspotWebhook,
  SUPPORTED_WEBHOOK_TYPES,
} from './webhooks'
import * as hubspotIndex from './index'

describe('stage mapping', () => {
  it('maps HubSpot stages to case status', () => {
    expect(mapHubspotStageToCaseStatus('qualifiedtobuy')).toBe('intake')
    expect(mapHubspotStageToCaseStatus('closedwon')).toBe('submitted')
    expect(mapHubspotStageToCaseStatus('closedlost')).toBe('rejected')
  })

  it('returns null for unknown stage', () => {
    expect(mapHubspotStageToCaseStatus('nonexistent')).toBeNull()
  })

  it('maps case status to HubSpot stages', () => {
    expect(mapCaseStatusToHubspotStage('draft')).toBe('qualifiedtobuy')
    expect(mapCaseStatusToHubspotStage('approved')).toBe('closedwon')
    expect(mapCaseStatusToHubspotStage('rejected')).toBe('closedlost')
  })

  it('returns null for unmapped case status', () => {
    expect(mapCaseStatusToHubspotStage('processing')).toBeNull()
  })

  it('has bidirectional mappings', () => {
    for (const [stage, status] of Object.entries(HUBSPOT_STAGE_TO_CASE_STATUS)) {
      const roundTrip = CASE_STATUS_TO_HUBSPOT_STAGE[status]
      // At least one HubSpot stage should map back
      expect(roundTrip).toBeDefined()
    }
  })
})

describe('hubspotContactSchema', () => {
  it('parses valid contact', () => {
    const result = hubspotContactSchema.parse({
      id: '123',
      properties: {
        firstname: 'John',
        lastname: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        country: 'NG',
        lifecyclestage: 'lead',
      },
    })
    expect(result.id).toBe('123')
    expect(result.properties.email).toBe('john@example.com')
  })

  it('defaults null for missing optional properties', () => {
    const result = hubspotContactSchema.parse({
      id: '123',
      properties: {},
    })
    expect(result.properties.firstname).toBeNull()
    expect(result.properties.email).toBeNull()
  })
})

describe('syncHubspotContact', () => {
  it('syncs a contact via the client', async () => {
    const mockClient: HubspotClient = {
      async getContact(id) {
        return {
          id,
          properties: {
            firstname: 'Jane',
            lastname: 'Doe',
            email: 'jane@example.com',
            phone: null,
            country: null,
            lifecyclestage: null,
          },
        }
      },
      async listContacts() {
        return { results: [] }
      },
    }

    const result = await syncHubspotContact(mockClient, '42', async (contact) => ({
      clientId: 'client-1',
      action: 'created' as const,
    }))

    expect(result.hubspotContactId).toBe('42')
    expect(result.clientId).toBe('client-1')
    expect(result.action).toBe('created')
  })

  it('formats details when names are missing', async () => {
    const mockClient: HubspotClient = {
      async getContact(id) {
        return {
          id,
          properties: {
            firstname: null,
            lastname: null,
            email: null,
            phone: null,
            country: null,
            lifecyclestage: null,
          },
        }
      },
      async listContacts() {
        return { results: [] }
      },
    }

    const result = await syncHubspotContact(mockClient, '99', async () => ({
      clientId: 'client-2',
      action: 'updated' as const,
    }))

    expect(result.details).toContain('updated')
  })
})

describe('syncHubspotDeal', () => {
  it('syncs a deal via the client', async () => {
    const mockClient: HubspotDealsClient = {
      async getDeal(id) {
        return {
          id,
          properties: {
            dealname: 'New Deal',
            amount: '1200',
            dealstage: 'qualifiedtobuy',
            pipeline: 'default',
            closedate: null,
          },
          associations: {
            contacts: {
              results: [{ id: 'c-1' }],
            },
          },
        }
      },
      async listDeals() {
        return { results: [] }
      },
    }

    const result = await syncHubspotDeal(mockClient, 'd-1', async () => ({
      caseId: 'case-1',
      action: 'created' as const,
    }))

    expect(result.hubspotDealId).toBe('d-1')
    expect(result.caseId).toBe('case-1')
    expect(result.action).toBe('created')
  })

  it('falls back to deal id when deal name is missing', async () => {
    const mockClient: HubspotDealsClient = {
      async getDeal(id) {
        return {
          id,
          properties: {
            dealname: null,
            amount: null,
            dealstage: null,
            pipeline: null,
            closedate: null,
          },
        }
      },
      async listDeals() {
        return { results: [] }
      },
    }

    const result = await syncHubspotDeal(mockClient, 'd-2', async () => ({
      caseId: 'case-2',
      action: 'updated' as const,
    }))

    expect(result.details).toContain('d-2')
    expect(result.action).toBe('updated')
  })
})

describe('ingestHubspotWebhook', () => {
  it('routes contact.creation to handler', async () => {
    let createdId: number | null = null

    const results = await ingestHubspotWebhook(
      [{
        subscriptionType: 'contact.creation',
        objectId: 123,
        occurredAt: Date.now(),
        eventId: 1,
        subscriptionId: 1,
        portalId: 1,
        appId: 1,
        attemptNumber: 0,
      }],
      {
        onContactCreated: async (id) => { createdId = id },
      },
    )

    expect(createdId).toBe(123)
    expect(results).toHaveLength(1)
    expect(results[0].processed).toBe(true)
  })

  it('returns unprocessed for unhandled event types', async () => {
    const results = await ingestHubspotWebhook(
      [{
        subscriptionType: 'contact.creation',
        objectId: 1,
        occurredAt: Date.now(),
        eventId: 1,
        subscriptionId: 1,
        portalId: 1,
        appId: 1,
        attemptNumber: 0,
      }],
      {},
    )

    expect(results[0].processed).toBe(false)
  })

  it('processes contact and deal webhook variants', async () => {
    const seen: string[] = []

    const results = await ingestHubspotWebhook(
      [
        {
          subscriptionType: 'contact.propertyChange',
          objectId: 11,
          propertyName: 'email',
          propertyValue: 'new@example.com',
          occurredAt: Date.now(),
          eventId: 10,
          subscriptionId: 1,
          portalId: 1,
          appId: 1,
          attemptNumber: 0,
        },
        {
          subscriptionType: 'contact.deletion',
          objectId: 12,
          occurredAt: Date.now(),
          eventId: 11,
          subscriptionId: 1,
          portalId: 1,
          appId: 1,
          attemptNumber: 0,
        },
        {
          subscriptionType: 'deal.creation',
          objectId: 21,
          occurredAt: Date.now(),
          eventId: 12,
          subscriptionId: 1,
          portalId: 1,
          appId: 1,
          attemptNumber: 0,
        },
        {
          subscriptionType: 'deal.propertyChange',
          objectId: 22,
          propertyName: 'dealstage',
          propertyValue: 'closedwon',
          occurredAt: Date.now(),
          eventId: 13,
          subscriptionId: 1,
          portalId: 1,
          appId: 1,
          attemptNumber: 0,
        },
        {
          subscriptionType: 'deal.deletion',
          objectId: 23,
          occurredAt: Date.now(),
          eventId: 14,
          subscriptionId: 1,
          portalId: 1,
          appId: 1,
          attemptNumber: 0,
        },
      ],
      {
        onContactUpdated: async (id, name, value) => { seen.push(`cu:${id}:${name}:${value}`) },
        onContactDeleted: async (id) => { seen.push(`cd:${id}`) },
        onDealCreated: async (id) => { seen.push(`dc:${id}`) },
        onDealUpdated: async (id, name, value) => { seen.push(`du:${id}:${name}:${value}`) },
        onDealDeleted: async (id) => { seen.push(`dd:${id}`) },
      },
    )

    expect(results.every((r) => r.processed)).toBe(true)
    expect(seen).toContain('cu:11:email:new@example.com')
    expect(seen).toContain('du:22:dealstage:closedwon')
  })

  it('leaves property change unprocessed when propertyName is missing', async () => {
    const results = await ingestHubspotWebhook(
      [{
        subscriptionType: 'deal.propertyChange',
        objectId: 1,
        propertyValue: 'x',
        occurredAt: Date.now(),
        eventId: 100,
        subscriptionId: 1,
        portalId: 1,
        appId: 1,
        attemptNumber: 0,
      }],
      {
        onDealUpdated: async () => {},
      },
    )

    expect(results[0].processed).toBe(false)
  })

  it('exposes expected barrel exports', () => {
    expect(hubspotIndex.syncHubspotContact).toBeTypeOf('function')
    expect(hubspotIndex.syncHubspotDeal).toBeTypeOf('function')
    expect(hubspotIndex.ingestHubspotWebhook).toBeTypeOf('function')
    expect(hubspotIndex.mapHubspotStageToCaseStatus).toBeTypeOf('function')
  })

  it('supports all documented webhook types', () => {
    expect(SUPPORTED_WEBHOOK_TYPES).toContain('contact.creation')
    expect(SUPPORTED_WEBHOOK_TYPES).toContain('deal.creation')
    expect(SUPPORTED_WEBHOOK_TYPES).toContain('deal.propertyChange')
  })
})
