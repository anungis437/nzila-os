import { describe, expect, it } from 'vitest'
import { createConnectionSchema, inboundPayloadSchema, paginationSchema } from './schemas'
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const connection = { orgId: id, appScope: 'platform', connectorType: 'webhook', name: 'Connector' }
describe('Zod 4 integration ingress compatibility', () => {
  it('preserves config defaults and nested metadata', () => {
    expect(createConnectionSchema.parse(connection).configJson).toEqual({})
    expect(createConnectionSchema.parse({ ...connection, configJson: { nested: { enabled: true } } }).configJson).toEqual({ nested: { enabled: true } })
  })
  it('rejects malformed tenants, metadata and inbound payloads', () => {
    expect(createConnectionSchema.safeParse({ ...connection, orgId: 'invalid' }).success).toBe(false)
    expect(createConnectionSchema.safeParse({ ...connection, configJson: ['invalid'] }).success).toBe(false)
    const inbound = { connectionId: id, eventType: 'member.created', sourceSystem: 'test', actorId: 'actor-1', payload: { member: 'm-1' } }
    expect(inboundPayloadSchema.parse(inbound).actorType).toBe('service')
    expect(inboundPayloadSchema.safeParse({ ...inbound, payload: ['invalid'] }).success).toBe(false)
  })
  it('enforces pagination bounds', () => {
    expect(paginationSchema.parse({}).pageSize).toBe(20)
    expect(paginationSchema.safeParse({ pageSize: 101 }).success).toBe(false)
  })
})
