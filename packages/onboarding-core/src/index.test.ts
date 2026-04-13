import { describe, it, expect } from 'vitest'
import * as onboardingCore from './index'

describe('onboarding-core barrel exports', () => {
  it('re-exports runtime API from package root', () => {
    expect(onboardingCore.createProgress).toBeTypeOf('function')
    expect(onboardingCore.completeStep).toBeTypeOf('function')
    expect(onboardingCore.registerFlow).toBeTypeOf('function')
    expect(onboardingCore.stepCompletedEvent).toBeTypeOf('function')
    expect(onboardingCore.StepBuilder).toBeTypeOf('function')
  })
})
