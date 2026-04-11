import { describe, it, expect, beforeEach } from 'vitest'

import {
  executeGovernedWorkflow,
  buildWorkflowRecord,
  workflow,
  registerWorkflow,
  getWorkflow,
  listWorkflows,
  clearWorkflowRegistry,
  workflowStartedEvent,
  workflowCompletedEvent,
} from '../index'
import type {
  GovernedWorkflowDef,
  GovernedWorkflowContext,
} from '../index'

import { pipeline, stage } from '@nzila/ingestion-core'
import type { PipelineDefinition } from '@nzila/ingestion-core'
import { machine, transition } from '@nzila/fsm-core'
import type { MachineDefinition } from '@nzila/fsm-core'
import { createPlatformEvent } from '@nzila/platform-events'

/* ─── Test fixtures ───────────────────────────────────── */

type ClaimState = 'draft' | 'submitted' | 'approved' | 'rejected'
type OrgRole = 'member' | 'admin'

interface RawClaim {
  claimantName: string
  amount: number
}

interface Claim {
  claimantName: string
  amount: number
  normalizedAmount: number
}

// Ingestion pipeline: normalize raw claim data
const claimPipeline: PipelineDefinition<RawClaim, Claim> = pipeline<RawClaim, Claim>(
  'claim-ingestion',
  '1.0.0',
)
  .addStage(
    stage<RawClaim, Claim>('normalize', async (ctx) => {
      const raw = ctx.rawInput
      ctx.entity = {
        claimantName: raw.claimantName.trim(),
        amount: raw.amount,
        normalizedAmount: Math.round(raw.amount * 100) / 100,
      }
    }),
  )
  .build()

// FSM: claim state machine
const claimMachine: MachineDefinition<ClaimState, Claim, OrgRole> = machine<
  ClaimState,
  Claim,
  OrgRole
>('claim-workflow', '1.0.0')
  .states(['draft', 'submitted', 'approved', 'rejected'])
  .initial('draft')
  .terminal('approved', 'rejected')
  .addTransition(
    transition<ClaimState, Claim, OrgRole>('draft', 'submitted', 'Submit claim')
      .allowRoles('member', 'admin'),
  )
  .addTransition(
    transition<ClaimState, Claim, OrgRole>('submitted', 'approved', 'Approve claim')
      .allowRoles('admin'),
  )
  .build()

// A failing pipeline for negative tests
const failingPipeline: PipelineDefinition<RawClaim, Claim> = pipeline<RawClaim, Claim>(
  'failing-ingestion',
  '1.0.0',
)
  .addStage(
    stage<RawClaim, Claim>('boom', async () => {
      throw new Error('Stage failure')
    }),
  )
  .build()

function makeCtx(overrides?: Partial<GovernedWorkflowContext<RawClaim, OrgRole>>): GovernedWorkflowContext<RawClaim, OrgRole> {
  return {
    correlationId: 'corr-001',
    orgId: 'org-001',
    actorId: 'actor-001',
    role: 'admin',
    source: 'test',
    rawInput: { claimantName: ' Alice ', amount: 100.456 },
    entityId: 'entity-001',
    ...overrides,
  }
}

/* ─── Orchestrator tests ──────────────────────────────── */

describe('executeGovernedWorkflow', () => {
  it('runs ingestion + FSM phases end-to-end', async () => {
    const def: GovernedWorkflowDef<RawClaim, Claim, ClaimState, OrgRole> = {
      name: 'claim-submission',
      version: '1.0',
      ingestion: { pipeline: claimPipeline },
      fsm: { machine: claimMachine, targetState: 'submitted' },
    }

    const result = await executeGovernedWorkflow(def, makeCtx(), {
      currentState: 'draft',
    })

    expect(result.outcome).toBe('completed')
    expect(result.workflowName).toBe('claim-submission')
    expect(result.workflowVersion).toBe('1.0')
    expect(result.correlationId).toBe('corr-001')
    expect(result.orgId).toBe('org-001')
    expect(result.actorId).toBe('actor-001')

    // Ingestion phase ran
    expect(result.ingestion.ran).toBe(true)
    if (result.ingestion.ran) {
      expect(result.ingestion.result.outcome).toBe('completed')
      expect(result.ingestion.record.pipelineName).toBe('claim-ingestion')
    }

    // FSM phase ran
    expect(result.fsm.ran).toBe(true)
    if (result.fsm.ran) {
      expect(result.fsm.result.ok).toBe(true)
      if (result.fsm.result.ok) {
        expect(result.fsm.result.to).toBe('submitted')
      }
    }

    // Entity was produced
    expect(result.entity).toEqual({
      claimantName: 'Alice',
      amount: 100.456,
      normalizedAmount: 100.46,
    })
    expect(result.currentState).toBe('submitted')

    // Timing
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.startedAt).toBeTruthy()
    expect(result.completedAt).toBeTruthy()
    expect(result.error).toBeUndefined()
  })

  it('runs ingestion-only workflow', async () => {
    const def: GovernedWorkflowDef<RawClaim, Claim, ClaimState, OrgRole> = {
      name: 'claim-ingest-only',
      version: '1.0',
      ingestion: { pipeline: claimPipeline },
    }

    const result = await executeGovernedWorkflow(def, makeCtx())

    expect(result.outcome).toBe('completed')
    expect(result.ingestion.ran).toBe(true)
    expect(result.fsm.ran).toBe(false)
    expect(result.entity).toEqual({
      claimantName: 'Alice',
      amount: 100.456,
      normalizedAmount: 100.46,
    })
    expect(result.currentState).toBeNull()
  })

  it('runs FSM-only workflow with pre-resolved entity', async () => {
    const entity: Claim = {
      claimantName: 'Bob',
      amount: 200,
      normalizedAmount: 200,
    }

    const def: GovernedWorkflowDef<RawClaim, Claim, ClaimState, OrgRole> = {
      name: 'claim-advance',
      version: '1.0',
      fsm: { machine: claimMachine, targetState: 'submitted' },
    }

    const result = await executeGovernedWorkflow(def, makeCtx(), {
      currentState: 'draft',
      entity,
    })

    expect(result.outcome).toBe('completed')
    expect(result.ingestion.ran).toBe(false)
    expect(result.fsm.ran).toBe(true)
    expect(result.currentState).toBe('submitted')
  })

  it('fails on ingestion failure', async () => {
    const def: GovernedWorkflowDef<RawClaim, Claim, ClaimState, OrgRole> = {
      name: 'claim-fail-ingest',
      version: '1.0',
      ingestion: { pipeline: failingPipeline },
      fsm: { machine: claimMachine, targetState: 'submitted' },
    }

    const result = await executeGovernedWorkflow(def, makeCtx(), {
      currentState: 'draft',
    })

    expect(result.outcome).toBe('ingestion_failed')
    expect(result.error).toBeTruthy()
    // FSM should NOT run when ingestion fails
    expect(result.fsm.ran).toBe(false)
  })

  it('fails on FSM transition failure', async () => {
    const def: GovernedWorkflowDef<RawClaim, Claim, ClaimState, OrgRole> = {
      name: 'claim-bad-transition',
      version: '1.0',
      fsm: { machine: claimMachine, targetState: 'approved' },
    }

    const entity: Claim = {
      claimantName: 'Charlie',
      amount: 50,
      normalizedAmount: 50,
    }

    // Try to go draft→approved (no direct transition exists)
    const result = await executeGovernedWorkflow(def, makeCtx(), {
      currentState: 'draft',
      entity,
    })

    expect(result.outcome).toBe('transition_failed')
    expect(result.fsm.ran).toBe(true)
    if (result.fsm.ran) {
      expect(result.fsm.result.ok).toBe(false)
    }
    expect(result.error).toBeTruthy()
  })

  it('fails when FSM phase has no currentState', async () => {
    const def: GovernedWorkflowDef<RawClaim, Claim, ClaimState, OrgRole> = {
      name: 'claim-no-state',
      version: '1.0',
      fsm: { machine: claimMachine, targetState: 'submitted' },
    }

    const result = await executeGovernedWorkflow(def, makeCtx(), {
      entity: { claimantName: 'X', amount: 1, normalizedAmount: 1 },
    })

    expect(result.outcome).toBe('transition_failed')
    expect(result.error).toContain('currentState')
  })

  it('fails when FSM phase has no entity', async () => {
    const def: GovernedWorkflowDef<RawClaim, Claim, ClaimState, OrgRole> = {
      name: 'claim-no-entity',
      version: '1.0',
      fsm: { machine: claimMachine, targetState: 'submitted' },
    }

    const result = await executeGovernedWorkflow(def, makeCtx(), {
      currentState: 'draft',
      // no entity provided, no ingestion to produce one
    })

    expect(result.outcome).toBe('transition_failed')
    expect(result.error).toContain('entity')
  })

  it('collects platform events when createEvent is provided', async () => {
    const def: GovernedWorkflowDef<RawClaim, Claim, ClaimState, OrgRole> = {
      name: 'claim-with-events',
      version: '1.0',
      ingestion: { pipeline: claimPipeline },
      fsm: { machine: claimMachine, targetState: 'submitted' },
    }

    const result = await executeGovernedWorkflow(def, makeCtx(), {
      currentState: 'draft',
      createEvent: createPlatformEvent,
    })

    expect(result.outcome).toBe('completed')
    // Should have ingestion events (started + completed) and FSM events
    expect(result.events.length).toBeGreaterThan(0)

    const eventTypes = result.events.map((e) => e.type)
    expect(eventTypes).toContain('ingestion.pipeline.started')
    expect(eventTypes).toContain('ingestion.pipeline.completed')
    expect(eventTypes).toContain('fsm.transition.completed')
  })

  it('produces no events when createEvent is not provided', async () => {
    const def: GovernedWorkflowDef<RawClaim, Claim, ClaimState, OrgRole> = {
      name: 'claim-no-events',
      version: '1.0',
      ingestion: { pipeline: claimPipeline },
      fsm: { machine: claimMachine, targetState: 'submitted' },
    }

    const result = await executeGovernedWorkflow(def, makeCtx(), {
      currentState: 'draft',
    })

    expect(result.outcome).toBe('completed')
    expect(result.events).toEqual([])
  })
})

/* ─── buildWorkflowRecord ─────────────────────────────── */

describe('buildWorkflowRecord', () => {
  it('builds an audit record from a completed result', async () => {
    const def: GovernedWorkflowDef<RawClaim, Claim, ClaimState, OrgRole> = {
      name: 'claim-audit',
      version: '2.0',
      ingestion: { pipeline: claimPipeline },
      fsm: { machine: claimMachine, targetState: 'submitted' },
    }

    const result = await executeGovernedWorkflow(def, makeCtx(), {
      currentState: 'draft',
    })

    const record = buildWorkflowRecord(result)

    expect(record.workflowRunId).toBe(result.workflowRunId)
    expect(record.workflowName).toBe('claim-audit')
    expect(record.workflowVersion).toBe('2.0')
    expect(record.outcome).toBe('completed')
    expect(record.ingestionOutcome).toBe('completed')
    expect(record.fsmOutcome).toBe('success')
    expect(record.durationMs).toBeGreaterThanOrEqual(0)
    expect(record.error).toBeUndefined()
  })

  it('records failure details', async () => {
    const def: GovernedWorkflowDef<RawClaim, Claim, ClaimState, OrgRole> = {
      name: 'claim-fail',
      version: '1.0',
      ingestion: { pipeline: failingPipeline },
    }

    const result = await executeGovernedWorkflow(def, makeCtx())
    const record = buildWorkflowRecord(result)

    expect(record.outcome).toBe('ingestion_failed')
    expect(record.ingestionOutcome).toBe('failed')
    expect(record.fsmOutcome).toBeNull()
    expect(record.error).toBeTruthy()
  })
})

/* ─── Builder tests ───────────────────────────────────── */

describe('GovernedWorkflowBuilder', () => {
  it('builds a workflow definition via fluent API', () => {
    const def = workflow<RawClaim, Claim, ClaimState, OrgRole>(
      'fluent-claim',
      '1.0',
    )
      .withIngestion(claimPipeline)
      .withFsm(claimMachine, 'submitted', { reason: 'test submit' })
      .withEvidence({ controlFamily: 'claims', retentionClass: '7_YEARS' })
      .build()

    expect(def.name).toBe('fluent-claim')
    expect(def.version).toBe('1.0')
    expect(def.ingestion?.pipeline).toBe(claimPipeline)
    expect(def.fsm?.machine).toBe(claimMachine)
    expect(def.fsm?.targetState).toBe('submitted')
    expect(def.fsm?.reason).toBe('test submit')
    expect(def.evidence?.controlFamily).toBe('claims')
    expect(def.evidence?.retentionClass).toBe('7_YEARS')
  })

  it('builds a minimal ingestion-only definition', () => {
    const def = workflow<RawClaim, Claim>('ingest-only', '1.0')
      .withIngestion(claimPipeline, { continueOnError: true })
      .build()

    expect(def.name).toBe('ingest-only')
    expect(def.ingestion?.continueOnError).toBe(true)
    expect(def.fsm).toBeUndefined()
  })

  it('produces a frozen (immutable) definition', () => {
    const def = workflow('frozen', '1.0').build()
    expect(Object.isFrozen(def)).toBe(true)
  })
})

/* ─── Registry tests ──────────────────────────────────── */

describe('Workflow registry', () => {
  beforeEach(() => {
    clearWorkflowRegistry()
  })

  it('registers and retrieves a workflow', () => {
    const def: GovernedWorkflowDef = { name: 'test-wf', version: '1.0' }
    registerWorkflow(def)

    const found = getWorkflow('test-wf', '1.0')
    expect(found).toBe(def)
  })

  it('throws on duplicate registration', () => {
    const def: GovernedWorkflowDef = { name: 'dup', version: '1.0' }
    registerWorkflow(def)

    expect(() => registerWorkflow(def)).toThrow('already registered')
  })

  it('returns undefined for unknown workflow', () => {
    expect(getWorkflow('nope', '1.0')).toBeUndefined()
  })

  it('lists all registered workflows', () => {
    registerWorkflow({ name: 'a', version: '1.0' })
    registerWorkflow({ name: 'b', version: '2.0' })

    const all = listWorkflows()
    expect(all).toHaveLength(2)
  })

  it('clears the registry', () => {
    registerWorkflow({ name: 'x', version: '1.0' })
    clearWorkflowRegistry()

    expect(listWorkflows()).toHaveLength(0)
  })
})

/* ─── Event bridge tests ──────────────────────────────── */

describe('Event bridge', () => {
  it('creates a workflow-started event', () => {
    const event = workflowStartedEvent(
      'run-001',
      'test-wf',
      '1.0',
      'corr-001',
      'test',
      { orgId: 'org-1', actorId: 'actor-1' },
      createPlatformEvent,
    )

    expect(event.type).toBe('governed-workflow.started')
    expect(event.payload.workflowRunId).toBe('run-001')
    expect(event.payload.workflowName).toBe('test-wf')
    expect(event.metadata.orgId).toBe('org-1')
    expect(event.metadata.correlationId).toBe('corr-001')
  })

  it('creates a workflow-completed event', async () => {
    const def: GovernedWorkflowDef<RawClaim, Claim, ClaimState, OrgRole> = {
      name: 'claim-event-test',
      version: '1.0',
      ingestion: { pipeline: claimPipeline },
    }

    const result = await executeGovernedWorkflow(def, makeCtx())
    const event = workflowCompletedEvent(result, createPlatformEvent)

    expect(event.type).toBe('governed-workflow.completed')
    expect(event.payload.outcome).toBe('completed')
    expect(event.payload.workflowName).toBe('claim-event-test')
    expect(event.payload.durationMs).toBeGreaterThanOrEqual(0)
    expect(event.metadata.orgId).toBe('org-001')
  })
})
