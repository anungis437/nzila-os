import { describe, expect, it } from 'vitest'
import { NextResponse } from 'next/server'
import { applyRecipientSecurityHeaders, recipientJson } from '../recipient-headers'

describe('recipient security headers', () => {
  it('sets no-store, no-referrer, noindex, nosniff, and a strict CSP', () => {
    const res = applyRecipientSecurityHeaders(NextResponse.json({ ok: true }))
    expect(res.headers.get('Cache-Control')).toContain('no-store')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(res.headers.get('X-Robots-Tag')).toContain('noindex')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'none'")
  })

  it('recipientJson applies the headers and status', () => {
    const res = recipientJson({ ok: false }, 403)
    expect(res.status).toBe(403)
    expect(res.headers.get('Cache-Control')).toContain('no-store')
  })
})
