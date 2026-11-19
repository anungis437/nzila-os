import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it, vi } from 'vitest'
import { storageAuthorityManifest } from '../../db/rls-storage-authority'
import { ueAuthorityWorkaidMatters, ueAuthorityWorkaidConsentTextProposals } from '../../db/schema/domains/ml/authority-kernel'
import { reconcileCurrentDeclarationAuthority } from './current-authority'

const effects = vi.hoisted(() => ({ database: vi.fn(() => { throw new Error('SQL_FORBIDDEN') }), actor: vi.fn() }))
vi.mock('@/lib/cases/case-authorization', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cases/case-authorization')>()),
  getCaseActor: effects.actor,
}))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: effects.database }))
vi.mock('@/lib/authority/store/workaid-disclosure', () => ({
  proposeConsentWording: effects.database, listOpenConsentWordingProposals: effects.database,
  adoptConsentWording: effects.database, withdrawConsentWordingProposal: effects.database,
}))

describe('base-release WorkAid wording retention boundary', () => {
  it('retains the exact current proposal declaration with zero authority and preserves historical decisions', () => {
    const prior = storageAuthorityManifest.find(row => row.table === 'ue_authority_workaid_consent_text_proposals')!
    const before = JSON.stringify(prior)
    const config = getTableConfig(ueAuthorityWorkaidConsentTextProposals)
    expect(config.columns.map(c => c.name)).toEqual(['id', 'organization_id', 'version', 'body', 'body_sha256', 'proposed_by', 'proposed_at', 'adopted_by', 'adopted_at', 'adopted_text_id', 'withdrawn_by', 'withdrawn_at', 'created_at'])
    const decision = reconcileCurrentDeclarationAuthority({ name: config.name, source: 'apps/union-eyes/db/schema/domains/ml/authority-kernel.ts' }, prior)!
    expect(decision).toMatchObject({ classification: 'CONTAINED_NO_AUTHORITY', requiredRuntimePrivileges: [], requiredSystemPrivileges: [], invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE' })
    expect(JSON.stringify(prior)).toBe(before)
    expect(() => reconcileCurrentDeclarationAuthority({ name: config.name, source: 'untrusted-source' }, prior)).toThrow('RETENTION_SOURCE_REQUIRED')
  })

  it('keeps both source-derived matter fields nullable with no manufactured default', () => {
    const columns = getTableConfig(ueAuthorityWorkaidMatters).columns
    for (const [name, type] of [['counsel_accepted_by', 'varchar(255)'], ['referred_categories', 'text[]']]) {
      const column = columns.find(c => c.name === name)!
      expect(column.getSQLType()).toBe(type)
      expect(column.notNull).toBe(false)
      expect(column.hasDefault).toBe(false)
    }
  })

  const PROPOSAL_ID = '00000000-0000-4000-8000-000000000001'
  const proposalCalls = async (proposalId = PROPOSAL_ID, body: unknown = { version: 'v1', body: 'institution wording' }) => {
    const root = await import('../../app/api/workaid/consent-text/proposals/route')
    const adopt = await import('../../app/api/workaid/consent-text/proposals/[proposalId]/adopt/route')
    const withdraw = await import('../../app/api/workaid/consent-text/proposals/[proposalId]/withdraw/route')
    const post = () => new Request('http://ue.test/api/workaid/consent-text/proposals', { method: 'POST', body: JSON.stringify(body) })
    const params = { params: Promise.resolve({ proposalId }) }
    return [() => root.GET(), () => root.POST(post()), () => adopt.POST(post(), params), () => withdraw.POST(post(), params)]
  }

  it('returns 501 from all four actual proposal handlers to an authenticated member without database or store effects', async () => {
    effects.actor.mockReset().mockResolvedValue({ userId: 'user-1', organizationId: 'org-1', role: 'member' })
    for (const call of await proposalCalls()) {
      const response = await call()
      expect(response.status).toBe(501)
      expect(await response.json()).toMatchObject({ success: false, error: 'NOT_IMPLEMENTED', code: 'WORKAID_WORDING_DEFERRED' })
    }
    expect(effects.actor).toHaveBeenCalledTimes(4)
    expect(effects.database).not.toHaveBeenCalled()
  })

  it('refuses an unauthenticated caller on all four proposal handlers before answering', async () => {
    const { ApiError } = await import('@/lib/api/errors')
    effects.actor.mockReset().mockRejectedValue(ApiError.unauthorized())
    for (const call of await proposalCalls()) {
      const response = await call()
      expect(response.status).toBe(401)
    }
    expect(effects.database).not.toHaveBeenCalled()
  })

  it('keeps the released input contract: a malformed proposal id or proposal body is a 400, never the 501', async () => {
    effects.actor.mockReset().mockResolvedValue({ userId: 'user-1', organizationId: 'org-1', role: 'member' })
    const [, rootPost, adopt, withdraw] = await proposalCalls('not-a-uuid', { version: '', body: '' })
    for (const call of [rootPost, adopt, withdraw]) {
      const response = await call()
      expect(response.status).toBe(400)
    }
    expect(effects.database).not.toHaveBeenCalled()
  })
})
