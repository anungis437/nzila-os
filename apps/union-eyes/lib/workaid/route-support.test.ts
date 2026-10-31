import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/cases/case-authorization', () => ({ caseAuthorizationResponse: () => null }))

import { AuthorityStoreError } from '@/lib/authority/store/executor'
import { COUNSEL_SIDE_NOTICE, workAidErrorResponse } from './route-support'

describe('WorkAid route support', () => {
  it('states on every success that nothing reached counsel', () => {
    expect(COUNSEL_SIDE_NOTICE).toMatchObject({ counselSide: 'not_activated', delivered: false, counselAcknowledged: false })
  })

  it('maps deliberate refusals to statuses and carries the refusal code, never a message that names members or documents', async () => {
    const cases: [AuthorityStoreError, number, string][] = [
      [new AuthorityStoreError('DENIED', 'CONSENT_NOT_LIVE: the consent is revoked'), 403, 'CONSENT_NOT_LIVE'],
      [new AuthorityStoreError('DENIED', 'workaid:refer denied: CONSENT_REQUIRED'), 403, 'CONSENT_REQUIRED'],
      [new AuthorityStoreError('NOT_FOUND', 'no consent is on record'), 404, 'NOT_FOUND'],
      [new AuthorityStoreError('PRECONDITION', 'CASE_ALREADY_REFERRED: x'), 409, 'CASE_ALREADY_REFERRED'],
      [new AuthorityStoreError('ALREADY_TERMINAL', 'the consent is already withdrawn'), 409, 'ALREADY_TERMINAL'],
    ]
    for (const [error, status, code] of cases) {
      const r = workAidErrorResponse(error)
      expect(r.status).toBe(status)
      expect(await r.json()).toEqual({ success: false, error: error.code, code })
    }
  })

  it('does not turn an unexpected failure into a response', () => {
    expect(() => workAidErrorResponse(new Error('database exploded'))).toThrow('database exploded')
  })

  it('answers 501 when the wording proposal store is not installed', async () => {
    const response = workAidErrorResponse(new AuthorityStoreError('PRECONDITION', 'STORE_UNAPPLIED: consent wording proposals are not installed'))
    expect(response.status).toBe(501)
    expect(await response.json()).toEqual({ success: false, error: 'PRECONDITION', code: 'STORE_UNAPPLIED' })
  })
})
