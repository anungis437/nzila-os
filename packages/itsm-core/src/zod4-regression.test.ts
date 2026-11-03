import { describe, expect, it } from 'vitest'
import { createAssetInputSchema, createOpsClientSchema, createTicketEventInputSchema, createTicketInputSchema } from './types'
const orgId = '4d1e6b3c-0c71-42af-8dc8-ae98a171dca2'
const ticketId = 'c36d58f8-047c-4e5d-8cb7-33e14484d536'
describe('Zod 4 ITSM ingress contracts', () => {
  it('retains ticket defaults and rejects malformed tenant and records', () => {
    const input = { orgId, type: 'incident', title: 'Portal unavailable', reportedById: 'reporter-1' }
    const parsed = createTicketInputSchema.parse(input)
    expect(parsed.priority).toBe('p3_medium')
    expect(parsed.channel).toBe('portal')
    expect(parsed.metadata).toEqual({})
    expect(createTicketInputSchema.safeParse({ ...input, orgId: 'wrong-tenant' }).success).toBe(false)
    expect(createTicketInputSchema.safeParse({ ...input, metadata: ['bad'] }).success).toBe(false)
    expect(createTicketInputSchema.safeParse({ ...input, type: 'unknown' }).success).toBe(false)
  })
  it('retains event visibility and rejects array payloads', () => {
    const event = { orgId, ticketId, eventType: 'status_changed', actorId: 'agent-1', payload: { to: 'triage' } }
    expect(createTicketEventInputSchema.parse(event).internal).toBe(false)
    expect(createTicketEventInputSchema.safeParse({ ...event, payload: ['bad'] }).success).toBe(false)
  })
  it('retains asset metadata and client defaults', () => {
    const asset = { orgId, type: 'laptop', name: 'Workstation', metadata: { encrypted: true } }
    expect(createAssetInputSchema.parse(asset).metadata).toEqual({ encrypted: true })
    expect(createAssetInputSchema.safeParse({ ...asset, metadata: 'invalid' }).success).toBe(false)
    const client = { orgId, companyName: 'Example', product: 'platform' }
    expect(createOpsClientSchema.parse(client).onboardingStage).toBe('prospect')
    expect(createOpsClientSchema.parse(client).health).toBe('healthy')
    expect(createOpsClientSchema.safeParse({ ...client, product: 'unregistered' }).success).toBe(false)
  })
})
