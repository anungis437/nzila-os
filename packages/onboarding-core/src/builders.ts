/**
 * @nzila/onboarding-core — Builders
 *
 * Fluent builders for constructing onboarding flows and steps.
 *
 * @module @nzila/onboarding-core/builders
 */
import type { OnboardingFlowDef, OnboardingStepDef, StepValidator } from './types'

// ── Step Builder ────────────────────────────────────────────────────────────

export class StepBuilder {
  private _name: string
  private _displayName: string
  private _required = true
  private _canStart?: StepValidator
  private _validate?: StepValidator
  private _dependsOn: string[] = []

  constructor(name: string) {
    this._name = name
    this._displayName = name
  }

  displayName(name: string): this {
    this._displayName = name
    return this
  }

  required(value = true): this {
    this._required = value
    return this
  }

  optional(): this {
    this._required = false
    return this
  }

  canStart(fn: StepValidator): this {
    this._canStart = fn
    return this
  }

  validate(fn: StepValidator): this {
    this._validate = fn
    return this
  }

  dependsOn(...steps: string[]): this {
    this._dependsOn.push(...steps)
    return this
  }

  build(): OnboardingStepDef {
    return {
      name: this._name,
      displayName: this._displayName,
      required: this._required,
      canStart: this._canStart,
      validate: this._validate,
      dependsOn: this._dependsOn.length > 0 ? this._dependsOn : undefined,
    }
  }
}

// ── Flow Builder ────────────────────────────────────────────────────────────

export class FlowBuilder {
  private _id: string
  private _displayName: string
  private _steps: OnboardingStepDef[] = []

  constructor(id: string) {
    this._id = id
    this._displayName = id
  }

  displayName(name: string): this {
    this._displayName = name
    return this
  }

  addStep(step: OnboardingStepDef): this {
    this._steps.push(step)
    return this
  }

  addStepDef(
    name: string,
    configure: (builder: StepBuilder) => StepBuilder = (b) => b,
  ): this {
    const builder = configure(new StepBuilder(name))
    this._steps.push(builder.build())
    return this
  }

  build(): OnboardingFlowDef {
    return {
      id: this._id,
      displayName: this._displayName,
      steps: this._steps,
    }
  }
}

// ── Factory Functions ───────────────────────────────────────────────────────

/** Create a step builder. */
export function step(name: string): StepBuilder {
  return new StepBuilder(name)
}

/** Create a flow builder. */
export function flow(id: string): FlowBuilder {
  return new FlowBuilder(id)
}
