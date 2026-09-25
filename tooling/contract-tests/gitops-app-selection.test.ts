import { describe, expect, it } from 'vitest'
import {
  appsFromChangedFiles,
  eligibleForEnv,
  GITOPS_DEPLOYABLE_APPS,
} from '../../scripts/release/deploy-app-selection'

describe('GitOps changed-app selection', () => {
  it('selects only supported apps changed by the merge', () => {
    expect(appsFromChangedFiles([
      'apps/web/app/page.tsx',
      'apps/cfo/app/api/health/route.ts',
      'apps/web/package.json',
      'scripts/release/run-smoke.ts',
      'packages/ui/src/button.tsx',
      'apps/union-eyes/app/page.tsx',
      'apps/not-a-gitops-target/app/page.tsx',
    ])).toEqual(['web', 'cfo'])
  })

  it('normalizes Windows paths and de-duplicates app names', () => {
    expect(appsFromChangedFiles([
      'apps\\control-plane\\app\\api\\health\\route.ts',
      'apps/control-plane/package.json',
    ])).toEqual(['control-plane'])
  })

  it('keeps Union Eyes outside the broad GitOps authority', () => {
    expect(GITOPS_DEPLOYABLE_APPS.has('union-eyes')).toBe(false)
  })
})

describe('GitOps incubation policy', () => {
  const incubating = { releaseStatus: 'incubating' as const, prodPromotionEligible: false }
  const staging = { releaseStatus: 'staging-only' as const, prodPromotionEligible: false }

  it('requires an explicit app selection for incubating surfaces', () => {
    expect(eligibleForEnv('cora', 'staging', incubating, false, false)).toBe(false)
    expect(eligibleForEnv('cora', 'staging', incubating, false, true)).toBe(true)
    expect(eligibleForEnv('cora', 'development', incubating, false, false)).toBe(false)
  })

  it('keeps active staging surfaces eligible for automatic selection', () => {
    expect(eligibleForEnv('control-plane', 'staging', staging, false, false)).toBe(true)
  })
})
