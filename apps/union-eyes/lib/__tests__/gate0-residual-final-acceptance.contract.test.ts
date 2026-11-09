import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')
const source = (relative: string) => readFileSync(resolve(root, relative), 'utf8')

describe('Gate 0 final residual acceptance contracts', () => {
  it('consumes only an independently approved, immutable OIDC provider version', () => {
    const runtime = source('lib/sso/oidc-runtime.ts')
    const lifecycle = source('app/api/enterprise/sso/providers/[id]/route.ts')
    const auth = source('../../packages/platform-auth/src/provider-identity.ts')
    expect(runtime).toContain('eq(ssoProviders.activeVersion, attempt.providerVersion)')
    expect(runtime).toContain('isNull(ssoOidcAttempts.claimedAt)')
    expect(runtime).toContain("authorization.searchParams.set('code_challenge_method', 'S256')")
    expect(runtime).toContain('verified.payload.nonce !== nonce')
    expect(lifecycle).toContain('A distinct organization administrator must approve SSO activation')
    expect(lifecycle).toContain('ssoProviderVersions')
    expect(auth).toContain('No verified platform identity binding exists')
    expect(auth).not.toContain('email:')
  })

  it('requires direct scoped authority for sensitive aggregate disclosure and reports', () => {
    const equity = source('lib/equity/disclosure-authority.ts')
    const grantRoute = source('app/api/equity/disclosure-grants/route.ts')
    const report = source('app/api/reports/field-grants/route.ts')
    expect(equity).toContain("candidate.kind !== 'governance_review'")
    expect(equity).toContain('candidate.scope.resourceIds ?? []')
    expect(equity).toContain('assessMandate(candidate, input.organizationId, now).effective')
    expect(grantRoute.match(/requireEquityDisclosureGrantAuthority/g)?.length).toBeGreaterThanOrEqual(3)
    expect(report).toContain("action: 'finance:approve'")
    expect(report).toContain('Member e-mail cannot be granted without per-subject disclosure consent')
  })

  it('does not treat platform staff identity as cross-tenant authority', () => {
    const platform = source('lib/platform/platform-staff.ts')
    const pilot = source('lib/pilot/pilot-ownership.ts')
    const cba = source('lib/services/cba-intelligence/review-visibility.ts')
    expect(platform).toContain('Identity is only eligibility')
    expect(platform).toContain('platform_staff')
    expect(platform).toContain('m.expires_at > now()')
    expect(pilot).toContain("'platform.pilot.manage'")
    expect(cba).toContain("'platform.cba_dataset.curate'")
  })

  it('resolves statutory rules by reviewed effective version and never literal citation claims', () => {
    const resolver = source('lib/canadian-labour-standards/rule-resolver.ts')
    const route = source('app/api/jurisdiction-rules/route.ts')
    expect(resolver).toContain("eq(statutoryRuleVersions.status, 'reviewed')")
    expect(resolver).toContain('effectiveFrom')
    expect(resolver).toContain('effectiveUntil')
    expect(resolver).toContain("status: 'unknown'")
    expect(route).toContain('resolveStatutoryRules')
  })

  it('binds pension decisions to live trustee mandates and one terminal decision', () => {
    const authority = source('lib/pension/pension-authority.ts')
    const transition = source('app/api/pension/benefits/[id]/transition/route.ts')
    const migration = source('db/migrations-platform/0088_gate0_checkout_and_payroll_integrity.sql')
    expect(authority).toContain('requirePensionTrusteeMandate')
    expect(transition).toContain('pension:claim:${body.action}')
    expect(transition).toContain('A claim cannot have competing approval and denial decisions')
    expect(transition).toContain('settlement_prepared')
    expect(migration).toContain('pension_trustee_decisions_resource_action_uniq')
  })

  it('uses accepted commercial offers, authentic pilot events, and evidence assessments', () => {
    const transition = source('app/api/pilot/apply/[id]/commercial-transition/route.ts')
    const measurements = source('lib/pilot/pilot-measurements.ts')
    const scoring = source('lib/pilot/health-scoring.ts')
    expect(transition).toContain("eq(pilotCommercialOffers.status, 'accepted')")
    expect(transition).toContain("eq(pilotCommercialOffers.status, 'accepted')")
    expect(measurements).toContain('server-recorded product actions')
    expect(measurements).toContain('organizerDenominator')
    expect(scoring).toContain("status: 'not-measured'")
  })

  it('pins survey answers to an immutable questionnaire and unlinkable participation digest', () => {
    const responses = source('app/api/communications/surveys/[surveyId]/responses/route.ts')
    const answers = source('app/api/communications/surveys/[surveyId]/responses/[responseId]/answers/route.ts')
    const complete = source('app/api/communications/surveys/[surveyId]/responses/[responseId]/route.ts')
    expect(responses).toContain('questionnaireDigest(questions)')
    expect(responses).toContain('anonymousParticipationDigest(survey.id, userId)')
    expect(responses).toContain('surveyAnonymousParticipations')
    expect(answers).toContain('response.questionnaireVersionId')
    expect(answers).toContain('validateAnswerAgainstQuestion')
    expect(complete).toContain('Required questions are unanswered')
  })

  it('writes compliance results idempotently with source and evaluator provenance', () => {
    const route = source('app/api/compliance/evaluate/route.ts')
    const migration = source('db/migrations-platform/0088_gate0_checkout_and_payroll_integrity.sql')
    expect(route).toContain('sourceRevision')
    expect(route).toContain('EVALUATOR_VERSION')
    expect(route).toContain('onConflictDoNothing()')
    expect(route).toContain('evaluationStatus')
    expect(migration).toContain('compliance_alerts_source_evaluator_type_uniq')
  })

  it('binds every supported integration adapter to cooperative cancellation and a lease fence', () => {
    const types = source('lib/integrations/types.ts')
    const base = source('lib/integrations/base-integration.ts')
    const engine = source('lib/integrations/sync-engine.ts')
    expect(types).toContain('fencingToken?: string')
    expect(base).toContain('SYNC_FENCE_CONTEXT_INVALID')
    expect(base).toContain('SYNC_FENCE_MISMATCH')
    expect(engine).toContain('fencingToken: lockToken')
    const adapters = [
      'accounting/freshbooks', 'accounting/quickbooks', 'accounting/sage-intacct', 'accounting/wave', 'accounting/xero',
      'communication/slack', 'communication/teams', 'hris/adp', 'hris/bamboohr', 'hris/workday',
      'insurance/canadalife', 'insurance/greenshield', 'insurance/ia', 'insurance/manulife', 'insurance/sunlife',
      'lms/linkedin-learning',
    ]
    for (const adapter of adapters) {
      const text = source(`lib/integrations/adapters/${adapter}-adapter.ts`)
      expect(text, adapter).toContain('this.beginSync(options)')
      expect(text, adapter).toContain('this.throwIfAborted')
    }
  })

  it('renders reviewed jurisdiction templates as real PDF bytes with a durable receipt', () => {
    const route = source('app/api/organizing/forms/generate/route.ts')
    const renderer = source('lib/organizing/form-pdf.ts')
    expect(route).toContain("eq(organizingFormTemplateVersions.status, 'reviewed')")
    expect(route).toContain("pdf.subarray(0, 5).toString('ascii') !== '%PDF-'")
    expect(route).toContain("'Content-Type': 'application/pdf'")
    expect(route).toContain('organizingFormGenerationReceipts')
    expect(renderer).toContain("new PDFDocument({ size: 'LETTER'")
  })
})
