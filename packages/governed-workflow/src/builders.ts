/**
 * @nzila/governed-workflow — Fluent builder
 *
 * Provides a type-safe, composable way to define governed workflows.
 */
import type { PipelineDefinition } from '@nzila/ingestion-core'
import type { MachineDefinition, GuardResolver } from '@nzila/fsm-core'

import type {
  GovernedWorkflowDef,
  IngestionPhase,
  FsmPhase,
  EvidencePhase,
} from './types'

export class GovernedWorkflowBuilder<
  TInput = unknown,
  TEntity = unknown,
  TState extends string = string,
  TRole extends string = string,
> {
  private _name: string
  private _version: string
  private _ingestion?: IngestionPhase<TInput, TEntity>
  private _fsm?: FsmPhase<TState, TEntity, TRole>
  private _evidence?: EvidencePhase

  constructor(name: string, version: string) {
    this._name = name
    this._version = version
  }

  /** Add an ingestion phase to the workflow. */
  withIngestion(
    pipeline: PipelineDefinition<TInput, TEntity>,
    opts?: { continueOnError?: boolean },
  ): this {
    this._ingestion = {
      pipeline,
      continueOnError: opts?.continueOnError,
    }
    return this
  }

  /** Add an FSM transition phase to the workflow. */
  withFsm(
    machine: MachineDefinition<TState, TEntity, TRole>,
    targetState: TState,
    opts?: {
      guardResolver?: GuardResolver<TState, TEntity, TRole>
      reason?: string
    },
  ): this {
    this._fsm = {
      machine,
      targetState,
      guardResolver: opts?.guardResolver,
      reason: opts?.reason,
    }
    return this
  }

  /** Add evidence configuration to the workflow. */
  withEvidence(config: EvidencePhase): this {
    this._evidence = config
    return this
  }

  /** Build the immutable workflow definition. */
  build(): GovernedWorkflowDef<TInput, TEntity, TState, TRole> {
    return Object.freeze({
      name: this._name,
      version: this._version,
      ingestion: this._ingestion,
      fsm: this._fsm,
      evidence: this._evidence,
    })
  }
}

/**
 * Create a governed workflow definition using the fluent builder.
 *
 * @example
 * ```ts
 * const def = workflow<RawClaim, Claim, ClaimState, OrgRole>(
 *   'claim-submission', '1.0'
 * )
 *   .withIngestion(claimPipeline)
 *   .withFsm(claimMachine, 'submitted')
 *   .withEvidence({ controlFamily: 'claims' })
 *   .build()
 * ```
 */
export function workflow<
  TInput = unknown,
  TEntity = unknown,
  TState extends string = string,
  TRole extends string = string,
>(
  name: string,
  version: string,
): GovernedWorkflowBuilder<TInput, TEntity, TState, TRole> {
  return new GovernedWorkflowBuilder<TInput, TEntity, TState, TRole>(name, version)
}
