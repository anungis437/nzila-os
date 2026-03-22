import { describe, it, expect } from 'vitest'
import {
  createSupplyChain,
  recordStep,
  completeStep,
  getCurrentPosition,
  verifyChainIntegrity,
  type SupplyChainStep,
} from '../supply-chain'

const NOW = new Date().toISOString()

function makeStep(
  overrides: Partial<SupplyChainStep> = {},
): Omit<SupplyChainStep, 'chain_id'> {
  return {
    id: `step_${Math.random().toString(36).slice(2, 6)}`,
    chain_id: '', // will be set by recordStep
    type: 'harvest',
    status: 'completed',
    timestamp: NOW,
    responsible_party: { id: 'p1', name: 'Jean', role: 'farmer' },
    ...overrides,
  }
}

describe('Supply Chain Engine', () => {
  describe('createSupplyChain', () => {
    it('creates an active chain with no steps', () => {
      const chain = createSupplyChain({
        batch_id: 'b1',
        crop_type: 'cassava',
        origin_cooperative_id: 'c1',
        origin_farmer_id: 'f1',
      })
      expect(chain.id).toMatch(/^sc_/)
      expect(chain.status).toBe('active')
      expect(chain.steps).toHaveLength(0)
      expect(chain.batch_id).toBe('b1')
    })
  })

  describe('recordStep', () => {
    it('adds a step to the chain', () => {
      let chain = createSupplyChain({
        batch_id: 'b1',
        crop_type: 'maize',
        origin_cooperative_id: 'c1',
        origin_farmer_id: 'f1',
      })
      chain = recordStep(chain, makeStep({ type: 'harvest' }))
      expect(chain.steps).toHaveLength(1)
      expect(chain.steps[0]!.type).toBe('harvest')
    })

    it('rejects out-of-order steps', () => {
      let chain = createSupplyChain({
        batch_id: 'b1',
        crop_type: 'maize',
        origin_cooperative_id: 'c1',
        origin_farmer_id: 'f1',
      })
      chain = recordStep(chain, makeStep({ type: 'transport' }))
      expect(() =>
        recordStep(chain, makeStep({ type: 'harvest' })),
      ).toThrow('Invalid step order')
    })

    it('auto-completes chain on delivery', () => {
      let chain = createSupplyChain({
        batch_id: 'b1',
        crop_type: 'maize',
        origin_cooperative_id: 'c1',
        origin_farmer_id: 'f1',
      })
      chain = recordStep(
        chain,
        makeStep({ type: 'delivery', status: 'completed' }),
      )
      expect(chain.status).toBe('completed')
    })

    it('rejects steps on a completed chain', () => {
      let chain = createSupplyChain({
        batch_id: 'b1',
        crop_type: 'maize',
        origin_cooperative_id: 'c1',
        origin_farmer_id: 'f1',
      })
      chain = recordStep(
        chain,
        makeStep({ type: 'delivery', status: 'completed' }),
      )
      expect(() =>
        recordStep(chain, makeStep({ type: 'delivery' })),
      ).toThrow('chain')
    })
  })

  describe('completeStep', () => {
    it('marks a step as completed', () => {
      let chain = createSupplyChain({
        batch_id: 'b1',
        crop_type: 'maize',
        origin_cooperative_id: 'c1',
        origin_farmer_id: 'f1',
      })
      const step = makeStep({ id: 'step1', type: 'harvest', status: 'in_progress' })
      chain = recordStep(chain, step)
      chain = completeStep(chain, 'step1')
      expect(chain.steps[0]!.status).toBe('completed')
      expect(chain.steps[0]!.completed_at).toBeDefined()
    })

    it('throws for unknown step', () => {
      const chain = createSupplyChain({
        batch_id: 'b1',
        crop_type: 'maize',
        origin_cooperative_id: 'c1',
        origin_farmer_id: 'f1',
      })
      expect(() => completeStep(chain, 'nonexistent')).toThrow('not found')
    })
  })

  describe('getCurrentPosition', () => {
    it('returns progress info', () => {
      let chain = createSupplyChain({
        batch_id: 'b1',
        crop_type: 'maize',
        origin_cooperative_id: 'c1',
        origin_farmer_id: 'f1',
      })
      chain = recordStep(chain, makeStep({ type: 'harvest', status: 'completed' }))
      chain = recordStep(chain, makeStep({ type: 'collection', status: 'in_progress' }))

      const pos = getCurrentPosition(chain)
      expect(pos.current_step).toBe('collection')
      expect(pos.steps_completed).toBe(1)
      expect(pos.steps_total).toBe(2)
      expect(pos.progress_pct).toBe(50)
    })

    it('returns null for empty chain', () => {
      const chain = createSupplyChain({
        batch_id: 'b1',
        crop_type: 'maize',
        origin_cooperative_id: 'c1',
        origin_farmer_id: 'f1',
      })
      const pos = getCurrentPosition(chain)
      expect(pos.current_step).toBeNull()
      expect(pos.progress_pct).toBe(0)
    })
  })

  describe('verifyChainIntegrity', () => {
    it('passes for valid chain', () => {
      let chain = createSupplyChain({
        batch_id: 'b1',
        crop_type: 'maize',
        origin_cooperative_id: 'c1',
        origin_farmer_id: 'f1',
      })
      chain = recordStep(chain, makeStep({ type: 'harvest' }))
      chain = recordStep(chain, makeStep({ type: 'collection' }))
      const result = verifyChainIntegrity(chain)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })
})
