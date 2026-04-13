import { describe, it, expect } from 'vitest'
import {
  canFollowStep,
  getNextStepTypes,
  isTerminalStep,
  SupplyChainFSM,
} from '../src/fsm'
import {
  createSupplyChain,
  recordEvent,
  cancelSupplyChain,
  getCurrentStep,
  getEventsForStep,
} from '../src/engine'
import {
  SupplyChainStepType,
  SupplyChainStepStatus,
  SupplyChainStatus,
} from '@nzila/agri-core'

// ── FSM tests ───────────────────────────────────────────────────────────────

describe('canFollowStep', () => {
  it('allows harvest → collection', () => {
    expect(canFollowStep(SupplyChainStepType.HARVEST, SupplyChainStepType.COLLECTION)).toEqual({ ok: true })
  })

  it('allows skipping processing (optional step)', () => {
    expect(canFollowStep(SupplyChainStepType.STORAGE, SupplyChainStepType.TRANSPORT)).toEqual({ ok: true })
  })

  it('rejects going backward', () => {
    const result = canFollowStep(SupplyChainStepType.DELIVERY, SupplyChainStepType.HARVEST)
    expect(result.ok).toBe(false)
  })

  it('rejects same step', () => {
    const result = canFollowStep(SupplyChainStepType.STORAGE, SupplyChainStepType.STORAGE)
    expect(result.ok).toBe(false)
  })

  it('allows harvest as first step (null previous)', () => {
    expect(canFollowStep(null, SupplyChainStepType.HARVEST)).toEqual({ ok: true })
  })

  it('rejects delivery as first step', () => {
    const result = canFollowStep(null, SupplyChainStepType.DELIVERY)
    expect(result.ok).toBe(false)
  })

  it('rejects unknown step type', () => {
    const result = canFollowStep(SupplyChainStepType.HARVEST, 'INVALID' as SupplyChainStepType)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Unknown step type')
    }
  })

  it('rejects skipping non-optional steps', () => {
    // HARVEST → STORAGE skips COLLECTION which is not optional
    const result = canFollowStep(SupplyChainStepType.HARVEST, SupplyChainStepType.STORAGE)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Cannot skip non-optional steps')
    }
  })
})

describe('getNextStepTypes', () => {
  it('returns HARVEST when current is null (start of chain)', () => {
    const next = getNextStepTypes(null)
    expect(next).toEqual([SupplyChainStepType.HARVEST])
  })

  it('returns COLLECTION after HARVEST', () => {
    const next = getNextStepTypes(SupplyChainStepType.HARVEST)
    expect(next).toContain(SupplyChainStepType.COLLECTION)
  })

  it('returns TRANSPORT from STORAGE (skip PROCESSING)', () => {
    const next = getNextStepTypes(SupplyChainStepType.STORAGE)
    expect(next).toContain(SupplyChainStepType.PROCESSING)
    expect(next).toContain(SupplyChainStepType.TRANSPORT)
  })

  it('returns empty after DELIVERY', () => {
    expect(getNextStepTypes(SupplyChainStepType.DELIVERY)).toEqual([])
  })
})

describe('isTerminalStep', () => {
  it('DELIVERY is terminal', () => {
    expect(isTerminalStep(SupplyChainStepType.DELIVERY)).toBe(true)
  })

  it('HARVEST is not terminal', () => {
    expect(isTerminalStep(SupplyChainStepType.HARVEST)).toBe(false)
  })
})

describe('SupplyChainFSM', () => {
  it('has step order defined', () => {
    expect(SupplyChainFSM.stepOrder).toHaveLength(6)
    expect(SupplyChainFSM.stepOrder[0]).toBe(SupplyChainStepType.HARVEST)
    expect(SupplyChainFSM.stepOrder[5]).toBe(SupplyChainStepType.DELIVERY)
  })

  it('exposes FSM functions', () => {
    expect(typeof SupplyChainFSM.canFollowStep).toBe('function')
    expect(typeof SupplyChainFSM.getNextStepTypes).toBe('function')
    expect(typeof SupplyChainFSM.isTerminalStep).toBe('function')
  })
})

// ── Engine tests ────────────────────────────────────────────────────────────

describe('createSupplyChain', () => {
  it('creates an active chain', () => {
    const chain = createSupplyChain({
      orgId: 'org_1',
      batchId: 'batch_1',
      cropType: 'MAIZE',
      originCooperativeId: 'coop_1',
      originProducerId: 'prod_1',
    })
    expect(chain.id).toMatch(/^sc_/)
    expect(chain.status).toBe(SupplyChainStatus.ACTIVE)
    expect(chain.events).toEqual([])
  })
})

describe('recordEvent', () => {
  it('records a harvest event', () => {
    const chain = createSupplyChain({
      orgId: 'org_1',
      batchId: 'batch_1',
      cropType: 'MAIZE',
      originCooperativeId: 'coop_1',
      originProducerId: 'prod_1',
    })
    const result = recordEvent(chain, {
      stepType: SupplyChainStepType.HARVEST,
      status: SupplyChainStepStatus.COMPLETED,
      responsibleParty: { id: 'rp1', name: 'John', role: 'farmer' },
      quantityKg: 500,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.chain.events).toHaveLength(1)
      expect(result.chain.events[0]!.stepType).toBe(SupplyChainStepType.HARVEST)
      expect(result.chain.status).toBe(SupplyChainStatus.ACTIVE)
    }
  })

  it('auto-completes on DELIVERY', () => {
    let chain = createSupplyChain({
      orgId: 'org_1',
      batchId: 'batch_1',
      cropType: 'MAIZE',
      originCooperativeId: 'coop_1',
      originProducerId: 'prod_1',
    })
    const steps = [
      SupplyChainStepType.HARVEST,
      SupplyChainStepType.COLLECTION,
      SupplyChainStepType.STORAGE,
      SupplyChainStepType.TRANSPORT,
      SupplyChainStepType.DELIVERY,
    ] as const
    for (const step of steps) {
      const result = recordEvent(chain, {
        stepType: step,
        status: SupplyChainStepStatus.COMPLETED,
        responsibleParty: { id: 'rp1', name: 'Jane', role: 'logistics' },
      })
      expect(result.ok).toBe(true)
      if (result.ok) chain = result.chain
    }
    expect(chain.status).toBe(SupplyChainStatus.COMPLETED)
  })

  it('returns error for invalid step order', () => {
    const chain = createSupplyChain({
      orgId: 'org_1',
      batchId: 'batch_1',
      cropType: 'MAIZE',
      originCooperativeId: 'coop_1',
      originProducerId: 'prod_1',
    })
    const result = recordEvent(chain, {
      stepType: SupplyChainStepType.DELIVERY,
      status: SupplyChainStepStatus.COMPLETED,
      responsibleParty: { id: 'rp1', name: 'X', role: 'y' },
    })
    expect(result.ok).toBe(false)
  })

  it('rejects recording on a cancelled chain', () => {
    const chain = cancelSupplyChain(createSupplyChain({
      orgId: 'org_1',
      batchId: 'batch_1',
      cropType: 'MAIZE',
      originCooperativeId: 'coop_1',
      originProducerId: 'prod_1',
    }))
    const result = recordEvent(chain, {
      stepType: SupplyChainStepType.HARVEST,
      status: SupplyChainStepStatus.COMPLETED,
      responsibleParty: { id: 'rp1', name: 'X', role: 'y' },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('cannot record new events')
    }
  })
})

describe('cancelSupplyChain', () => {
  it('changes status to CANCELLED', () => {
    const chain = createSupplyChain({
      orgId: 'org_1',
      batchId: 'batch_1',
      cropType: 'MAIZE',
      originCooperativeId: 'coop_1',
      originProducerId: 'prod_1',
    })
    const cancelled = cancelSupplyChain(chain)
    expect(cancelled.status).toBe(SupplyChainStatus.CANCELLED)
  })
})

describe('getCurrentStep', () => {
  it('returns null for empty chain', () => {
    const chain = createSupplyChain({
      orgId: 'org_1',
      batchId: 'batch_1',
      cropType: 'MAIZE',
      originCooperativeId: 'coop_1',
      originProducerId: 'prod_1',
    })
    expect(getCurrentStep(chain)).toBeNull()
  })

  it('returns the latest step type', () => {
    let chain = createSupplyChain({
      orgId: 'org_1',
      batchId: 'batch_1',
      cropType: 'MAIZE',
      originCooperativeId: 'coop_1',
      originProducerId: 'prod_1',
    })
    const result = recordEvent(chain, {
      stepType: SupplyChainStepType.HARVEST,
      status: SupplyChainStepStatus.COMPLETED,
      responsibleParty: { id: 'rp1', name: 'X', role: 'y' },
    })
    if (result.ok) chain = result.chain
    expect(getCurrentStep(chain)).toBe(SupplyChainStepType.HARVEST)
  })
})

describe('getEventsForStep', () => {
  it('filters events by step type', () => {
    let chain = createSupplyChain({
      orgId: 'org_1',
      batchId: 'batch_1',
      cropType: 'MAIZE',
      originCooperativeId: 'coop_1',
      originProducerId: 'prod_1',
    })
    let result = recordEvent(chain, {
      stepType: SupplyChainStepType.HARVEST,
      status: SupplyChainStepStatus.COMPLETED,
      responsibleParty: { id: 'rp1', name: 'X', role: 'y' },
    })
    if (result.ok) chain = result.chain
    result = recordEvent(chain, {
      stepType: SupplyChainStepType.COLLECTION,
      status: SupplyChainStepStatus.IN_PROGRESS,
      responsibleParty: { id: 'rp2', name: 'Y', role: 'z' },
    })
    if (result.ok) chain = result.chain
    expect(getEventsForStep(chain, SupplyChainStepType.HARVEST)).toHaveLength(1)
    expect(getEventsForStep(chain, SupplyChainStepType.COLLECTION)).toHaveLength(1)
    expect(getEventsForStep(chain, SupplyChainStepType.STORAGE)).toHaveLength(0)
  })
})
