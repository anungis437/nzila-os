import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveOrgContext } from './org-context'

describe('resolveOrgContext', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns header org context when x-org-id is valid', () => {
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-org-id': 'metro_university-01' },
    })

    expect(resolveOrgContext(req)).toEqual({
      orgId: 'metro_university-01',
      source: 'header',
    })
  })

  it('falls back to ABR_DEMO_ORG_ID when header is missing', () => {
    vi.stubEnv('ABR_DEMO_ORG_ID', 'demo_org_01')
    const req = new Request('http://localhost/api/test')

    expect(resolveOrgContext(req)).toEqual({
      orgId: 'demo_org_01',
      source: 'demo-default',
    })
  })

  it('falls back to ABR_DEMO_ORG_ID when header is invalid', () => {
    vi.stubEnv('ABR_DEMO_ORG_ID', 'demo-org')
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-org-id': '!invalid!' },
    })

    expect(resolveOrgContext(req)).toEqual({
      orgId: 'demo-org',
      source: 'demo-default',
    })
  })

  it('returns null when both header and fallback org are invalid', () => {
    vi.stubEnv('ABR_DEMO_ORG_ID', '!!')
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-org-id': '$$' },
    })

    expect(resolveOrgContext(req)).toBeNull()
  })
})
