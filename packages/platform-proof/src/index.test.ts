import { describe, expect, it } from 'vitest'
import * as platformProof from './index'

describe('platform-proof index exports', () => {
  it('exposes runtime proof generators and ports', () => {
    expect(typeof platformProof.generateGovernanceProofPack).toBe('function')
    expect(typeof platformProof.computeSignatureHash).toBe('function')
    expect(typeof platformProof.generateIntegrationsProofSection).toBe('function')
    expect(typeof platformProof.generateAbrProofSection).toBe('function')
    expect(typeof platformProof.generateNacpIntegrityProofSection).toBe('function')
    expect(typeof platformProof.generateDataLifecycleProofSection).toBe('function')
    expect(typeof platformProof.nacpIntegrityPorts.fetchSealStatuses).toBe('function')
  })
})
