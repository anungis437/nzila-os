/**
 * S55 / F06 R5 pins — provider and institutional dependencies are isolated by contracts, not by silence.
 * Behaviour is proven in the focused suites named beside each pin; these keep a later edit from routing around the contract.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(__dirname, '../../..')
const src = (rel: string) => readFileSync(path.join(root, rel), 'utf8')

describe('S55 F06 R5 dependency isolation', () => {
  it('turning on an SSO provider or an integration goes through the activation guard before anything is stored', () => {
    const create = src('app/api/enterprise/sso/providers/route.ts')
    expect(create.indexOf('refuseUnavailableActivation(')).toBeGreaterThan(0)
    expect(create.indexOf('refuseUnavailableActivation(')).toBeLessThan(create.indexOf('encryptSecret(validated'))
    const patch = src('app/api/enterprise/sso/providers/[id]/route.ts')
    expect(patch.indexOf('refuseUnavailableActivation(')).toBeLessThan(patch.indexOf('.update(ssoProviders)'))
    const ext = src('app/api/extensions/[id]/route.ts')
    expect(ext.indexOf('refuseUnavailableActivation(')).toBeLessThan(ext.indexOf('.update(apiIntegrations)'))
  })

  it('the guard stops refusing only when the effect itself says a consumer exists', () => {
    expect(src('lib/reality/activation-guard.ts')).toContain('if (input.effect.inEffect || input.asked.length === 0) return')
    const effect = src('lib/reality/configuration-effect.ts')
    expect(effect).toMatch(/SSO_SIGN_IN_EFFECT[^]*?inEffect: false/)
    expect(effect).toMatch(/INTEGRATION_SYNC_EFFECT[^]*?inEffect: false/)
  })

  it('knowledge-base reads of a parent\'s rows go through the entitlement policy, which is provisional and fails closed', () => {
    const policy = src('lib/knowledge-transfer/governance/kb-entitlement.ts')
    expect(policy).toContain('approvedBy: null')
    expect(policy).toMatch(/catch \{\s*return false/)
    expect(src('app/api/knowledge-base/route.ts')).toContain('knowledgeBaseReadScope(')
    expect(src('app/api/knowledge-base/[id]/route.ts')).toContain("action: 'knowledge_base.read_denied'")
  })

  it('a pilot contract\'s acceptance carries its evidence level into the contract, the invoice, the subscription and the audit row', () => {
    const route = src('app/api/pilot/apply/[id]/commercial-transition/route.ts')
    expect(route).toContain('verifyCounterpartAcceptance(')
    // verified before the transaction opens, never while the pilot row is locked
    expect(route.indexOf('verifyCounterpartAcceptance(')).toBeLessThan(route.indexOf('FOR UPDATE') > 0 ? route.indexOf('FOR UPDATE') : route.indexOf('withRLSContext'))
    for (const operation of ['pilot.commercial.contract_signed', 'pilot.commercial.invoice_issued', 'pilot.commercial.subscription_active']) {
      expect(route).toContain(operation)
    }
    expect(route).toContain('acceptanceEvidence: monetization.acceptanceEvidence')
    const policy = src('lib/pilot/counterpart-acceptance.ts')
    expect(policy).toContain('approvedBy: null')
    expect(policy).not.toMatch(/docusign|hellosign/i)
  })

  it('the people a workbook names have a durable notice record, written only by an identified person and never by the request body', () => {
    const notice = src('lib/workbook/holder-notice.ts')
    expect(notice).toContain('approvedBy: null')
    expect(notice).toContain('notifiedBy: actorUserId')
    expect(src('app/api/workbook/[id]/memory-holders/[holderId]/route.ts')).toContain('assertNoticeContract(')
    expect(src('app/api/workbook/[id]/memory-holders/route.ts')).toContain('summarizeNotice(')
    expect(src('db/schema/workbook-schema.ts')).toContain("noticeState: varchar('notice_state'")
  })
})
