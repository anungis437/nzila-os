import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  privacyRequestInput, privacyResponseInput, responseCoversRequestedScope, supportsAccountExport,
  readPrivacyThreadBinding, readPrivacyResponse, PRIVACY_REQUEST_CONTRACT,
} from './request-contract'

describe('privacy request trust boundaries', () => {
  it('refuses identity, organization and server metadata supplied in a request body', () => {
    const request = { requestType: 'access', scopes: ['account_profile'], description: 'Provide my own account information.', clientRequestId: randomUUID() }
    expect(privacyRequestInput.safeParse(request).success).toBe(true)
    for (const key of ['userId','organizationId','status','verifiedBy','response_data','metadata'])
      expect(privacyRequestInput.safeParse({ ...request, [key]: 'caller-controlled' }).success).toBe(false)
    expect(privacyRequestInput.safeParse({ ...request, scopes: ['account_profile','account_profile'] }).success).toBe(false)
  })

  it('requires a response precondition and refuses client-installed response sequence or verification timestamp', () => {
    const response = { action: 'respond', body: 'The requested categories were reviewed.', expectedResponseId: null, clientRequestId: randomUUID() }
    expect(privacyResponseInput.safeParse(response).success).toBe(true)
    expect(privacyResponseInput.safeParse({ ...response, expectedResponseId: undefined }).success).toBe(false)
    expect(privacyResponseInput.safeParse({ ...response, sequence: 1 }).success).toBe(false)
    expect(privacyResponseInput.safeParse({ ...response, verifiedAt: new Date().toISOString() }).success).toBe(false)
  })

  it('requires exactly one inclusion or reasoned exemption for every requested category', () => {
    expect(responseCoversRequestedScope(['account_profile','case_records'], { coveredScopes: ['account_profile'], exemptions: [{ scope: 'case_records', reason: 'Controlled third-party review required' }] })).toBe(true)
    expect(responseCoversRequestedScope(['account_profile'], { coveredScopes: ['account_profile'], exemptions: [{ scope: 'account_profile', reason: 'Duplicate' }] })).toBe(false)
    expect(responseCoversRequestedScope(['account_profile','case_records'], { coveredScopes: ['account_profile'], exemptions: [] })).toBe(false)
    expect(responseCoversRequestedScope(['account_profile'], { coveredScopes: ['consents'], exemptions: [] })).toBe(false)
  })

  it('never treats business records, communications or erasure requests as an account JSON export', () => {
    expect(supportsAccountExport('access',['account_profile','consents','privacy_requests'])).toBe(true)
    expect(supportsAccountExport('portability',['account_profile'])).toBe(true)
    expect(supportsAccountExport('access',['account_profile','case_records'])).toBe(false)
    expect(supportsAccountExport('access',['communications'])).toBe(false)
    expect(supportsAccountExport('erasure',['account_profile'])).toBe(false)
    expect(supportsAccountExport('access',[])).toBe(false)
  })

  it('refuses legacy, malformed or over-permissive binding metadata', () => {
    expect(readPrivacyThreadBinding('not JSON')).toBeNull()
    expect(readPrivacyThreadBinding({ requestId: randomUUID() })).toBeNull()
    expect(readPrivacyThreadBinding({ privacyRequest: { contract: PRIVACY_REQUEST_CONTRACT, requestId: randomUUID(), requestType: 'access', scopes: ['account_profile'], userId: 'forged' } })).toBeNull()
    expect(readPrivacyResponse({ privacyResponse: { contract: PRIVACY_REQUEST_CONTRACT, requestId: randomUUID(), action: 'respond', coveredScopes: ['account_profile'], exemptions: [], payloadHash: 'a'.repeat(64), sequence: 0 } })).toBeNull()
  })
})
