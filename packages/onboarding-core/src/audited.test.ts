import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OnboardingFlowDef } from './types'
import { createProgress } from './engine'
import { executeOnboardingStep } from './audited'

const mocked = vi.hoisted(() => ({
  auditedAction: vi.fn(),
  addArtifact: vi.fn(),
}))

vi.mock('@nzila/os-core', () => ({
  auditedAction: mocked.auditedAction,
}))

const flow: OnboardingFlowDef = {
  id: 'default',
  displayName: 'Default',
  steps: [
    { name: 'org_info', displayName: 'Org Info', required: true },
  ],
}

beforeEach(() => {
  mocked.addArtifact.mockReset()
  mocked.auditedAction.mockReset()
  mocked.auditedAction.mockImplementation(async (_meta: unknown, fn: (ctx: { addArtifact: typeof mocked.addArtifact }) => unknown) => {
    const data = await fn({ addArtifact: mocked.addArtifact })
    return { data }
  })
})

describe('executeOnboardingStep', () => {
  it('returns onboarding record and stores artifact for successful step completion', async () => {
    const progress = createProgress('org-1', 'default')

    const { result, record } = await executeOnboardingStep(
      flow,
      progress,
      'org_info',
      'actor-1',
      'org-1',
      { legalName: 'Acme' },
    )

    expect(result.ok).toBe(true)
    expect(record.outcome).toBe('completed')
    expect(record.stepName).toBe('org_info')
    expect(mocked.addArtifact).toHaveBeenCalledTimes(1)
  })

  it('maps failed step attempts into failed onboarding records without artifact', async () => {
    const progress = createProgress('org-1', 'default')

    const { result, record } = await executeOnboardingStep(
      flow,
      progress,
      'unknown_step',
      'actor-1',
      'org-1',
    )

    expect(result.ok).toBe(false)
    expect(record.outcome).toBe('failed')
    expect(record.stepName).toBe('unknown_step')
    expect(mocked.addArtifact).not.toHaveBeenCalled()
  })
})
