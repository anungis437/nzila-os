import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it, vi } from 'vitest'
import { storageAuthorityManifest } from '../../db/rls-storage-authority'
import { ueAuthorityWorkaidMatters, ueAuthorityWorkaidConsentTextProposals } from '../../db/schema/domains/ml/authority-kernel'
import { reconcileCurrentDeclarationAuthority } from './current-authority'

const effects = vi.hoisted(() => ({ database: vi.fn(() => { throw new Error('SQL_FORBIDDEN') }) }))
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

  it('returns 501 from all four actual proposal handlers without database or store effects', async () => {
    const root = await import('../../app/api/workaid/consent-text/proposals/route')
    const adopt = await import('../../app/api/workaid/consent-text/proposals/[proposalId]/adopt/route')
    const withdraw = await import('../../app/api/workaid/consent-text/proposals/[proposalId]/withdraw/route')
    for (const handler of [root.GET, root.POST, adopt.POST, withdraw.POST]) {
      const response = await handler()
      expect(response.status).toBe(501)
      expect(await response.json()).toMatchObject({ success: false, error: 'NOT_IMPLEMENTED', code: 'WORKAID_WORDING_DEFERRED' })
    }
    expect(effects.database).not.toHaveBeenCalled()
  })
})
