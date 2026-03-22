/**
 * Agrimo — Supply-Chain Engine.
 *
 * Track harvest → collection → storage → transport → delivery.
 * Each step contains status, timestamp, location, responsible party.
 */
import { z } from 'zod'

// ── Schemas ─────────────────────────────────────────────────────────────────

export const SupplyChainStepType = z.enum([
  'harvest',
  'collection',
  'storage',
  'processing',
  'transport',
  'delivery',
])

export const SupplyChainStepSchema = z.object({
  id: z.string(),
  chain_id: z.string(),
  type: SupplyChainStepType,
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'skipped']),
  timestamp: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      name: z.string().optional(),
    })
    .optional(),
  responsible_party: z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
  }),
  quantity_kg: z.number().nonnegative().optional(),
  quality_grade: z.string().optional(),
  notes: z.string().optional(),
  device_id: z.string().optional(),
})

export const SupplyChainSchema = z.object({
  id: z.string(),
  batch_id: z.string(),
  crop_type: z.string(),
  origin_cooperative_id: z.string(),
  origin_farmer_id: z.string(),
  destination: z.string().optional(),
  steps: z.array(SupplyChainStepSchema),
  status: z.enum(['active', 'completed', 'cancelled']),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// ── Types ───────────────────────────────────────────────────────────────────

export type SupplyChainStepType_T = z.infer<typeof SupplyChainStepType>
export type SupplyChainStep = z.infer<typeof SupplyChainStepSchema>
export type SupplyChain = z.infer<typeof SupplyChainSchema>

// ── Engine ──────────────────────────────────────────────────────────────────

const STEP_ORDER: SupplyChainStepType_T[] = [
  'harvest',
  'collection',
  'storage',
  'processing',
  'transport',
  'delivery',
]

/** Create a new supply chain for a crop batch. */
export function createSupplyChain(params: {
  batch_id: string
  crop_type: string
  origin_cooperative_id: string
  origin_farmer_id: string
  destination?: string
}): SupplyChain {
  const now = new Date().toISOString()
  return {
    id: `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    batch_id: params.batch_id,
    crop_type: params.crop_type,
    origin_cooperative_id: params.origin_cooperative_id,
    origin_farmer_id: params.origin_farmer_id,
    destination: params.destination,
    steps: [],
    status: 'active',
    created_at: now,
    updated_at: now,
  }
}

/** Record a step in the supply chain. Validates order. */
export function recordStep(
  chain: SupplyChain,
  step: Omit<SupplyChainStep, 'chain_id'>,
): SupplyChain {
  if (chain.status !== 'active') {
    throw new Error(`Cannot record step: chain ${chain.id} is ${chain.status}`)
  }

  // Validate step ordering
  const lastStep = chain.steps[chain.steps.length - 1]
  if (lastStep) {
    const lastIndex = STEP_ORDER.indexOf(lastStep.type)
    const newIndex = STEP_ORDER.indexOf(step.type)
    if (newIndex < lastIndex) {
      throw new Error(
        `Invalid step order: cannot go from ${lastStep.type} to ${step.type}`,
      )
    }
  }

  const fullStep: SupplyChainStep = { ...step, chain_id: chain.id }
  const updatedSteps = [...chain.steps, fullStep]

  // Auto-complete chain when delivery is done
  const isComplete =
    step.type === 'delivery' && step.status === 'completed'

  return {
    ...chain,
    steps: updatedSteps,
    status: isComplete ? 'completed' : 'active',
    updated_at: new Date().toISOString(),
  }
}

/** Complete the current step and advance. */
export function completeStep(
  chain: SupplyChain,
  stepId: string,
): SupplyChain {
  const stepIndex = chain.steps.findIndex((s) => s.id === stepId)
  if (stepIndex === -1) {
    throw new Error(`Step ${stepId} not found in chain ${chain.id}`)
  }

  const step = chain.steps[stepIndex]!
  const now = new Date().toISOString()
  const updatedStep: SupplyChainStep = {
    ...step,
    status: 'completed',
    completed_at: now,
  }

  const updatedSteps = [...chain.steps]
  updatedSteps[stepIndex] = updatedStep

  const isChainComplete =
    updatedStep.type === 'delivery'

  return {
    ...chain,
    steps: updatedSteps,
    status: isChainComplete ? 'completed' : 'active',
    updated_at: now,
  }
}

/** Get current position in the supply chain. */
export function getCurrentPosition(chain: SupplyChain): {
  current_step: SupplyChainStepType_T | null
  progress_pct: number
  steps_completed: number
  steps_total: number
} {
  const completedSteps = chain.steps.filter((s) => s.status === 'completed')
  const lastActive = chain.steps.findLast(
    (s) => s.status === 'in_progress' || s.status === 'completed',
  )

  return {
    current_step: lastActive?.type ?? null,
    progress_pct:
      chain.steps.length > 0
        ? Math.round((completedSteps.length / chain.steps.length) * 100)
        : 0,
    steps_completed: completedSteps.length,
    steps_total: chain.steps.length,
  }
}

/** Verify chain integrity — no gaps, valid ordering. */
export function verifyChainIntegrity(chain: SupplyChain): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  for (let i = 1; i < chain.steps.length; i++) {
    const prev = chain.steps[i - 1]!
    const curr = chain.steps[i]!
    const prevIdx = STEP_ORDER.indexOf(prev.type)
    const currIdx = STEP_ORDER.indexOf(curr.type)

    if (currIdx < prevIdx) {
      errors.push(
        `Step ${i}: ${curr.type} comes before ${prev.type} in expected order`,
      )
    }

    if (new Date(curr.timestamp) < new Date(prev.timestamp)) {
      errors.push(
        `Step ${i}: timestamp ${curr.timestamp} is before previous step ${prev.timestamp}`,
      )
    }
  }

  return { valid: errors.length === 0, errors }
}
