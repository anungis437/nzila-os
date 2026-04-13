import { describe, it, expect, beforeEach } from 'vitest'
import { clearFlowRegistry, getFlow, listFlows, registerFlow, unregisterFlow } from './registry'
import type { OnboardingFlowDef } from './types'

const flowA: OnboardingFlowDef = {
  id: 'default',
  displayName: 'Default',
  steps: [
    { name: 'org_info', displayName: 'Org Info', required: true },
  ],
}

beforeEach(() => {
  clearFlowRegistry()
})

describe('flow registry', () => {
  it('registers, retrieves, lists and unregisters flows', () => {
    registerFlow(flowA)

    expect(getFlow('default')?.id).toBe('default')
    expect(listFlows()).toEqual(['default'])

    expect(unregisterFlow('default')).toBe(true)
    expect(unregisterFlow('default')).toBe(false)
    expect(getFlow('default')).toBeUndefined()
  })

  it('throws for invalid flow definitions', () => {
    const invalid: OnboardingFlowDef = {
      id: 'broken',
      displayName: 'Broken',
      steps: [{ name: 'a', displayName: 'A', required: false }],
    }

    expect(() => registerFlow(invalid)).toThrow('Invalid onboarding flow "broken"')
  })
})
