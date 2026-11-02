import { describe, expect, it } from 'vitest'
import { CreateIntegrationConfigSchema, SendMessageSchema, UpdateIntegrationConfigSchema } from './schemas'

const orgId = '123e4567-e89b-42d3-a456-426614174000'
const correlationId = '123e4567-e89b-42d3-a456-426614174001'

describe('Zod 4 integration record and tenancy boundaries', () => {
  it('retains metadata defaults and dictionary values', () => {
    const parsed = CreateIntegrationConfigSchema.parse({ orgId, type: 'email', provider: 'resend', credentialsRef: 'vault:key' })
    expect(parsed.metadata).toEqual({})
    expect(UpdateIntegrationConfigSchema.parse({ metadata: { region: 'ca', retries: 2 } }).metadata).toEqual({ region: 'ca', retries: 2 })
    expect(SendMessageSchema.parse({ orgId, correlationId, channel: 'email', to: 'test@example.ca', variables: { name: 'Ada' } }).variables).toEqual({ name: 'Ada' })
  })

  it('rejects arrays masquerading as metadata, malformed IDs and malformed records', () => {
    expect(UpdateIntegrationConfigSchema.safeParse({ metadata: [] }).success).toBe(false)
    expect(SendMessageSchema.safeParse({ orgId: 'wrong-org', correlationId, channel: 'email', to: 'x' }).success).toBe(false)
    expect(SendMessageSchema.safeParse({ orgId, correlationId: 'replayed', channel: 'email', to: 'x' }).success).toBe(false)
  })
})
