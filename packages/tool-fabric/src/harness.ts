/**
 * @nzila/tool-fabric — harness-generation lifecycle
 *
 * Generation and approval are separate decisions. A generated harness is a
 * CANDIDATE: finishing the lifecycle yields a descriptor that enters the
 * ToolRegistry as DISCOVERED, where it still needs a trust decision.
 */
import { z } from 'zod'

import { TOOL_SIDE_EFFECTS, type PrincipalRef, type ToolDescriptor, type ToolSideEffect } from './types'

export const HARNESS_REVIEW_GATES = [
  'CODE_REVIEW',
  'SECURITY_REVIEW',
  'CAPABILITY_REVIEW',
  'TESTS',
  'PROVENANCE_CAPTURE',
] as const
export type HarnessReviewGate = (typeof HARNESS_REVIEW_GATES)[number]

export const HARNESS_STATES = [
  'REQUESTED',
  'GENERATION_AUTHORISED',
  'GENERATED',
  'IN_REVIEW',
  'READY_FOR_TRUST_EVALUATION',
  'REJECTED',
] as const
export type HarnessState = (typeof HARNESS_STATES)[number]

export interface HarnessGenerationRequest {
  readonly requestId: string
  readonly targetSoftware: string
  /** Authorised source repository or path the generator may read. */
  readonly targetSource: string
  readonly desiredCapabilities: readonly string[]
  readonly prohibitedCapabilities: readonly string[]
  readonly prohibitedSideEffects: readonly ToolSideEffect[]
  readonly expectedCommandGroups: readonly string[]
  readonly expectedOutputFormat: 'JSON'
  readonly testRequirements: readonly string[]
  readonly validationRequirements: readonly string[]
  readonly licenseConstraints: readonly string[]
  readonly requestingMission: string
  readonly requestingAgent: string
}

export const harnessGenerationRequestSchema: z.ZodType<HarnessGenerationRequest> = z
  .object({
    requestId: z.string().min(1),
    targetSoftware: z.string().min(1),
    targetSource: z.string().min(1),
    desiredCapabilities: z.array(z.string().min(1)).min(1),
    prohibitedCapabilities: z.array(z.string().min(1)),
    prohibitedSideEffects: z.array(z.enum(TOOL_SIDE_EFFECTS)),
    expectedCommandGroups: z.array(z.string().min(1)),
    expectedOutputFormat: z.literal('JSON'),
    testRequirements: z.array(z.string().min(1)).min(1),
    validationRequirements: z.array(z.string().min(1)).min(1),
    licenseConstraints: z.array(z.string()),
    requestingMission: z.string().min(1),
    requestingAgent: z.string().min(1),
  })
  .strict()
  .refine((r) => r.desiredCapabilities.every((c) => !r.prohibitedCapabilities.includes(c)), {
    message: 'a capability cannot be both desired and prohibited',
    path: ['desiredCapabilities'],
  })

export interface HarnessLifecycleRecord {
  readonly request: HarnessGenerationRequest
  readonly state: HarnessState
  readonly authorisedBy: PrincipalRef | null
  readonly passedGates: readonly HarnessReviewGate[]
  readonly candidate: ToolDescriptor | null
  readonly history: ReadonlyArray<{ readonly at: string; readonly to: HarnessState; readonly by: string }>
}

export class HarnessLifecycle {
  private readonly records = new Map<string, HarnessLifecycleRecord>()

  /** Anyone may *request*; a request carries no generator authority. */
  request(input: unknown, at: string): HarnessLifecycleRecord {
    const request = harnessGenerationRequestSchema.parse(input)
    if (this.records.has(request.requestId)) {
      throw new Error(`Harness request "${request.requestId}" already exists`)
    }
    const record: HarnessLifecycleRecord = {
      request,
      state: 'REQUESTED',
      authorisedBy: null,
      passedGates: [],
      candidate: null,
      history: [{ at, to: 'REQUESTED', by: request.requestingAgent }],
    }
    this.records.set(request.requestId, record)
    return record
  }

  get(requestId: string): HarnessLifecycleRecord | undefined {
    return this.records.get(requestId)
  }

  authoriseGeneration(requestId: string, by: PrincipalRef, at: string): HarnessLifecycleRecord {
    const r = this.require(requestId, 'REQUESTED')
    if (by.id === r.request.requestingAgent) {
      throw new Error('A requester cannot authorise its own generation request')
    }
    return this.move(r, 'GENERATION_AUTHORISED', by.id, at, { authorisedBy: by })
  }

  /** Records generator output as an unapproved candidate. */
  recordGenerated(requestId: string, candidate: ToolDescriptor, at: string): HarnessLifecycleRecord {
    const r = this.require(requestId, 'GENERATION_AUTHORISED')
    if (candidate.sourceClass !== 'GENERATED_HARNESS') {
      throw new Error('Generated candidates must have sourceClass GENERATED_HARNESS')
    }
    const prohibited = new Set(r.request.prohibitedSideEffects)
    const hit = candidate.declaredSideEffects.filter((s) => prohibited.has(s))
    if (hit.length > 0) {
      throw new Error(`Candidate declares prohibited side effects: ${hit.join(', ')}`)
    }
    const banned = candidate.claimedCapabilities.filter((c) => r.request.prohibitedCapabilities.includes(c))
    if (banned.length > 0) {
      throw new Error(`Candidate claims prohibited capabilities: ${banned.join(', ')}`)
    }
    return this.move(r, 'GENERATED', 'generator', at, { candidate })
  }

  startReview(requestId: string, at: string): HarnessLifecycleRecord {
    const r = this.require(requestId, 'GENERATED')
    return this.move(r, 'IN_REVIEW', 'governance', at, {})
  }

  passGate(requestId: string, gate: HarnessReviewGate, by: PrincipalRef, at: string): HarnessLifecycleRecord {
    const r = this.require(requestId, 'IN_REVIEW')
    if (by.id === r.request.requestingAgent) {
      throw new Error('A requester cannot pass review gates for its own harness')
    }
    if (r.passedGates.includes(gate)) return r
    const passedGates = [...r.passedGates, gate]
    const updated: HarnessLifecycleRecord = { ...r, passedGates }
    this.records.set(requestId, updated)
    return updated
  }

  /** Completes review. Output is a candidate for trust evaluation, never an approval. */
  completeReview(requestId: string, at: string): HarnessLifecycleRecord {
    const r = this.require(requestId, 'IN_REVIEW')
    const missing = HARNESS_REVIEW_GATES.filter((g) => !r.passedGates.includes(g))
    if (missing.length > 0) throw new Error(`Review gates outstanding: ${missing.join(', ')}`)
    return this.move(r, 'READY_FOR_TRUST_EVALUATION', 'governance', at, {})
  }

  reject(requestId: string, by: PrincipalRef, at: string): HarnessLifecycleRecord {
    const r = this.records.get(requestId)
    if (!r) throw new Error(`Unknown harness request "${requestId}"`)
    if (r.state === 'READY_FOR_TRUST_EVALUATION' || r.state === 'REJECTED') {
      throw new Error(`Cannot reject from ${r.state}`)
    }
    return this.move(r, 'REJECTED', by.id, at, {})
  }

  private require(requestId: string, state: HarnessState): HarnessLifecycleRecord {
    const r = this.records.get(requestId)
    if (!r) throw new Error(`Unknown harness request "${requestId}"`)
    if (r.state !== state) throw new Error(`Harness request is ${r.state}; expected ${state}`)
    return r
  }

  private move(
    r: HarnessLifecycleRecord,
    to: HarnessState,
    by: string,
    at: string,
    patch: Partial<Pick<HarnessLifecycleRecord, 'authorisedBy' | 'candidate'>>,
  ): HarnessLifecycleRecord {
    const next: HarnessLifecycleRecord = { ...r, ...patch, state: to, history: [...r.history, { at, to, by }] }
    this.records.set(r.request.requestId, next)
    return next
  }
}
