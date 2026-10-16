import { describe, expect, it } from 'vitest'
import { AiControlPlaneError } from './types'
import { guardRestrictedGatewayRequest } from './restricted-guard'

describe('restricted gateway guard', () => {
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
