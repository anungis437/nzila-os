import { describe, expect, it } from 'vitest'
import { NextResponse } from 'next/server'
import { hashCapabilityToken } from '@/lib/icra/assessment-capability'
import {
  clearWorkbookCapabilityCookie,
  extractWorkbookCapability,
  issueWorkbookCapability,
  setWorkbookCapabilityCookie,
  workbookCapabilityCookieName,
  workbookCapabilityHolds,
} from '../workbook-capability'

const ID = '00000000-0000-4000-8000-0000000000a1'
const req = (headers: Record<string, string>, url = `http://localhost/api/workbook/${ID}/memory-holders`) => new Request(url, { headers })

describe('workbook capability', () => {
  it('issues a fresh token whose stored form is a hash of it, with an expiry', () => {
    const a = issueWorkbookCapability(new Date('2026-01-01T00:00:00Z'))
    const b = issueWorkbookCapability()

    expect(a.token).not.toBe(b.token)
    expect(a.tokenHash).toBe(hashCapabilityToken(a.token))
    expect(a.tokenHash).not.toContain(a.token)
    expect(a.expiresAt.getTime()).toBeGreaterThan(new Date('2026-01-01T00:00:00Z').getTime())
  })

  it('reads the capability from the Authorization header or the workbook\'s own cookie, and from nothing else', () => {
    expect(extractWorkbookCapability(req({ authorization: 'Bearer tok-h' }), ID)).toBe('tok-h')
    expect(extractWorkbookCapability(req({ cookie: `other=1; ${workbookCapabilityCookieName(ID)}=tok-c` }), ID)).toBe('tok-c')
    // another workbook's cookie, an assessment's cookie, and a query parameter are not this workbook's capability
    expect(extractWorkbookCapability(req({ cookie: 'wbk_cap_other=tok-x' }), ID)).toBeNull()
    expect(extractWorkbookCapability(req({ cookie: `icra_cap_${ID}=tok-icra` }), ID)).toBeNull()
    expect(extractWorkbookCapability(req({}, `http://localhost/api/workbook/${ID}/memory-holders?capability=tok-q&token=tok-q`), ID)).toBeNull()
  })

  it('does not throw on a malformed cookie value, it simply holds no capability', () => {
    expect(extractWorkbookCapability(req({ cookie: `${workbookCapabilityCookieName(ID)}=%E0%A4%A` }), ID)).toBeNull()
  })

  it('holds only for the token the workbook was issued, before its expiry', () => {
    const issued = issueWorkbookCapability()
    const row = { capabilityTokenHash: issued.tokenHash, capabilityTokenExpiresAt: issued.expiresAt }

    expect(workbookCapabilityHolds(issued.token, row)).toBe(true)
    expect(workbookCapabilityHolds(issueWorkbookCapability().token, row)).toBe(false)
    expect(workbookCapabilityHolds(null, row)).toBe(false)
    expect(workbookCapabilityHolds(issued.token, { ...row, capabilityTokenExpiresAt: new Date('2020-01-01T00:00:00Z') })).toBe(false)
    // a workbook with no capability on record (created before it existed, or claimed) admits nobody
    expect(workbookCapabilityHolds(issued.token, { capabilityTokenHash: null, capabilityTokenExpiresAt: null })).toBe(false)
  })

  it('sets an HttpOnly, path-wide cookie and clears it', () => {
    const response = NextResponse.json({})
    setWorkbookCapabilityCookie(response, ID, 'tok')
    const set = response.cookies.get(workbookCapabilityCookieName(ID))
    expect(set).toMatchObject({ value: 'tok', httpOnly: true, sameSite: 'lax', path: '/' })

    clearWorkbookCapabilityCookie(response, ID)
    expect(response.cookies.get(workbookCapabilityCookieName(ID))).toMatchObject({ value: '', maxAge: 0 })
  })
})
