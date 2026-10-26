import { describe, expect, it } from 'vitest'
import { proposeConsentWording } from '../store/workaid-disclosure'
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
