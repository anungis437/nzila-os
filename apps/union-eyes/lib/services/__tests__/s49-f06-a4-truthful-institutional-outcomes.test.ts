import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('F06 batch 3 (A4): an outcome is recorded only when the system did it or can show it', () => {
  it('commercial transition refuses instead of staging, requires counterpart acceptance evidence, and gates status on approved terms', () => {
    const route = src('app/api/pilot/apply/[id]/commercial-transition/route.ts')
    expect(route).not.toContain('staged only')
    expect(route).not.toContain('monetization.notes.push(')
    expect(route).toContain('EFFECT_TARGET_STATES')
    expect(route).toContain('TERMS_REQUIRED_STATES.includes(targetState)')
    expect(route).toContain("targetState === 'contract_signed' && !body.counterpartAcceptance")
    expect(route).toContain("verification: 'recorded_by_platform_operator'")
    expect(route).toContain('No accepted contract exists for this pilot')
    expect(src('lib/pilot/write-payloads.ts')).toContain('counterpartAcceptance')
  })

  it('organization verification compares the applicant with the organization and records what held', () => {
    const own = src('lib/pilot/pilot-ownership.ts')
    expect(own).toContain('contactIsActiveMember')
    expect(own).toContain('organizationNameMatches')
    expect(own).toContain('acknowledgeUncorroborated')
    expect(own).toContain('uncorroboratedAcknowledged: !corroborated')
    expect(src('app/api/pilot/apply/[id]/verify-organization/route.ts')).toContain('acknowledgeUncorroborated')
  })

  it('onboarding checklist steps need evidence in the organization data; reopening does not', () => {
    const route = src('app/api/pilot/onboarding/route.ts')
    expect(route).toContain('verifyChecklistStep(tx, organizationId, userId')
    expect(route).toContain('if (completed) {')
    const evidence = src('lib/pilot/onboarding-checklist-evidence.ts')
    for (const step of ['org-seeded', 'users-invited', 'roles-assigned', 'contracts-uploaded', 'employers-imported', 'integrations-configured', 'export-verified']) {
      expect(evidence).toContain(`case '${step}'`)
    }
    expect(evidence).toContain("ne(organizationMembers.userId, actorUserId)")
  })

  it('onboarding events are verified against membership before the event and audit row are written', () => {
    const route = src('app/api/onboarding/events/route.ts')
    expect(route).toContain('verifyOnboardingMilestone(')
    expect(route.indexOf('verifyOnboardingMilestone(')).toBeLessThan(route.indexOf('.insert(pilotEvents)'))
    const evidence = src('lib/pilot/onboarding-event-evidence.ts')
    expect(evidence).toContain('the target user is not a member of this organization')
    expect(evidence).toContain('the target member does not hold that role')
  })

  it('the pilot overview needs platform-administrator authority, is paged, batched and audited', () => {
    const route = src('app/api/pilot/overview/route.ts')
    expect(route).toContain('isPlatformAdminUser(user.userId)')
    expect(route).not.toContain('DEFAULT_ORGANIZATION_ID)')
    expect(route).not.toContain('currentStateContextEnabled')
    expect(route).toContain("action: 'pilot.overview.read'".replace(/'/g, '"'))
    expect(route).toContain('MAX_PAGE_SIZE')
    expect(route).not.toContain('Promise.all(')
  })

  it('a payroll run is sealed only after its remittance exists', () => {
    const t = src('lib/employer-execution/payroll-run-transitions.ts')
    const seal = t.slice(t.indexOf('export async function executeRun'))
    expect(seal.indexOf('employerRemittanceRuns')).toBeGreaterThan(-1)
    expect(seal.indexOf('employerRemittanceRuns')).toBeLessThan(seal.indexOf('status: "posted"'))
    expect(seal).toContain('remittanceRunId: remittance.id')
  })

  it('stored SSO and integration configuration says it is not in effect on every read, write and audit record', () => {
    const effect = src('lib/reality/configuration-effect.ts')
    expect(effect).toMatch(/SSO_SIGN_IN_EFFECT[^]*inEffect: false/)
    expect(effect).toMatch(/INTEGRATION_SYNC_EFFECT[^]*inEffect: false/)
    for (const file of ['app/api/enterprise/sso/providers/route.ts', 'app/api/enterprise/sso/providers/[id]/route.ts']) {
      expect(src(file)).toContain('SSO_SIGN_IN_EFFECT')
    }
    expect(src('app/api/extensions/[id]/route.ts')).toContain('INTEGRATION_SYNC_EFFECT.inEffect')
    const registry = src('lib/reality/capability-registry.ts')
    expect(registry).toContain("id: 'UE-SSO-SIGN-IN'")
    expect(registry).toContain("id: 'UE-EXT-INTEGRATION-SYNC'")
  })
})
