import { describe, expect, it } from 'vitest'

import { buildAiRequestAuditAfterJson } from './logging'

describe('ai-core logging trace attribution', () => {
  it('includes domain trace metadata in audit payloads', () => {
    const afterJson = buildAiRequestAuditAfterJson({
      appKey: 'union-eyes',
      feature: 'generate',
      provider: 'azure_openai',
      modelOrDeployment: 'gpt-4.1-mini',
      status: 'success',
      tokensIn: 12,
      tokensOut: 34,
      costUsd: 0.02,
      latencyMs: 1234,
      trace: {
        correlationId: 'corr-1',
        domainType: 'organization',
        domainId: 'cupe4373',
      },
      requestHash: '1234567890abcdef1234567890abcdef',
      responseHash: 'fedcba0987654321fedcba0987654321',
    })

    expect(afterJson).toMatchObject({
      appKey: 'union-eyes',
      correlationId: 'corr-1',
      domainType: 'organization',
      domainId: 'cupe4373',
      requestHash: '1234567890ab',
      responseHash: 'fedcba098765',
    })
  })
})
