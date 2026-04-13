import { describe, it, expect } from 'vitest'
import { flow, step, FlowBuilder, StepBuilder } from './builders'

describe('onboarding builders', () => {
  it('builds a step with optional flags, validators, and dependencies', () => {
    const canStart = (data: Record<string, unknown>) => data.ready === true
    const validate = (data: Record<string, unknown>) => typeof data.name === 'string'

    const built = step('details')
      .displayName('Details')
      .optional()
      .required(true)
      .canStart(canStart)
      .validate(validate)
      .dependsOn('org_info', 'people')
      .build()

    expect(built.name).toBe('details')
    expect(built.displayName).toBe('Details')
    expect(built.required).toBe(true)
    expect(built.canStart).toBe(canStart)
    expect(built.validate).toBe(validate)
    expect(built.dependsOn).toEqual(['org_info', 'people'])
  })

  it('builds flows via fluent API and addStepDef', () => {
    const direct = new StepBuilder('org_info').displayName('Org Info').build()

    const built = new FlowBuilder('default')
      .displayName('Default Onboarding')
      .addStep(direct)
      .addStepDef('people', (b) => b.displayName('People').dependsOn('org_info'))
      .build()

    expect(built.id).toBe('default')
    expect(built.displayName).toBe('Default Onboarding')
    expect(built.steps).toHaveLength(2)
    expect(built.steps[1]?.dependsOn).toEqual(['org_info'])

    const fromFactories = flow('factory').addStepDef('one').build()
    expect(fromFactories.id).toBe('factory')
    expect(fromFactories.steps[0]?.name).toBe('one')
  })
})
