import { describe, expect, it } from 'vitest'
import { listCaseWorkAidReferrals, proposeConsentWording } from '../store/workaid-disclosure'
import { referToWorkAid } from '../store/workflow'
import type { EnforcementDeps } from '../store/enforce'
import type { SqlExecutor } from '../store/executor'

describe('consent wording proposals', () => {
  it('does not read an election or a consent text when the proposal relation is absent', async () => {
    const queries: string[] = []
    const exec = {
      query: async (sql: string) => {
        queries.push(sql)
        return { rows: [{ rel: null }] }
      },
    } as unknown as SqlExecutor
    await expect(proposeConsentWording(exec, { memberships: async () => [] }, {
      organizationId: '00000000-0000-4000-8000-00000000000a',
      proposerUserId: 'user_executive',
      version: 'v1',
      body: 'caller supplied text',
    })).rejects.toThrow(/STORE_UNAPPLIED/)
    expect(queries).toHaveLength(1)
    expect(queries[0]).toContain('to_regclass')
    expect(queries.join('\n')).not.toContain('ue_authority_workaid_consent_texts')
    expect(queries.join('\n')).not.toContain('council_elections')
  })
})

describe('referral scope provenance', () => {
  it('does not read consent categories when the referral-scope column is absent', async () => {
    const queries: string[] = []
    const exec = {
      query: async (sql: string) => {
        queries.push(sql)
        if (sql.includes('current_setting')) return { rows: [{ u: 'user_rep' }] }
        if (sql.includes('referred_categories')) return { rows: [{ ok: false }] }
        throw new Error(`unexpected query: ${sql}`)
      },
    } as unknown as SqlExecutor
    const deps = { memberships: async () => [], now: () => new Date() } as unknown as EnforcementDeps
    await expect(listCaseWorkAidReferrals(exec, deps, {
      organizationId: '00000000-0000-4000-8000-00000000000a',
      actorUserId: 'user_rep',
      caseId: '00000000-0000-4000-8000-00000000000c',
    })).rejects.toThrow(/STORE_UNAPPLIED/)
    await expect(referToWorkAid(exec, deps, {
      organizationId: '00000000-0000-4000-8000-00000000000a',
      referrerUserId: 'user_rep',
      caseId: '00000000-0000-4000-8000-00000000000c',
      memberUserId: 'user_member',
      categories: ['case_summary'],
      matterId: '00000000-0000-4000-8000-00000000000d',
    })).rejects.toThrow(/STORE_UNAPPLIED/)
    expect(queries.join('\n')).not.toContain('ue_authority_disclosure_consents')
    expect(queries.join('\n')).not.toContain('ue_authority_workaid_matters WHERE')
  })
})
