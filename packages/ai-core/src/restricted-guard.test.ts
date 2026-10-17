import { describe, expect, it } from 'vitest'
import { AiControlPlaneError } from './types'
import { guardRestrictedGatewayRequest } from './restricted-guard'
import { AiGenerateRequestSchema, AiChatStreamRequestSchema, AiEmbedRequestSchema, AiExtractRequestSchema, AiRagQueryRequestSchema } from './schemas'

describe('restricted gateway guard', () => {
  it.each([AiGenerateRequestSchema, AiChatStreamRequestSchema, AiEmbedRequestSchema, AiExtractRequestSchema, AiRagQueryRequestSchema])('retains governance classification through request parsing and denies it before providers', (schema) => {
    const parsed = schema.parse({ orgId: '00000000-0000-4000-8000-000000000001', appKey: 'synthetic', profileKey: 'synthetic', input: 'synthetic', query: 'synthetic', promptKey: 'synthetic', dataClass: 'internal', classification: 'RESTRICTED', modelPathId: 'azure-openai-eastus' })
    expect(parsed.classification).toBe('RESTRICTED')
    expect(parsed.modelPathId).toBe('azure-openai-eastus')
    expect(() => guardRestrictedGatewayRequest({ ...parsed, text: 'synthetic' })).toThrow(AiControlPlaneError)
    expect(schema.safeParse({ ...parsed, classification: 'restricted' }).success).toBe(false)
  })
  it('fails closed for Restricted and leaves an ordinary data class alone', () => {
    expect(() => guardRestrictedGatewayRequest({
      classification: 'RESTRICTED',
      dataClass: 'internal',
      modelPathId: 'azure-openai-eastus2-whisper',
      redactionMode: 'off',
      text: 'synthetic proposition',
    })).toThrow(AiControlPlaneError)

    expect(() => guardRestrictedGatewayRequest({
      dataClass: 'regulated',
      redactionMode: 'off',
      text: 'ordinary internal note',
    })).not.toThrow()
  })
})
