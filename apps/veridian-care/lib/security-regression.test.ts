import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const layoutSrc = readFileSync(resolve(__dirname, '../app/layout.tsx'), 'utf8')
const warningSrc = readFileSync(resolve(__dirname, '../components/synthetic-warning.tsx'), 'utf8')
const proxySrc = readFileSync(resolve(__dirname, '../proxy.ts'), 'utf8')

describe('veridian-care synthetic no-PHI posture', () => {
  it('renders synthetic warning banner from root layout', () => {
    expect(layoutSrc).toContain('<SyntheticWarning />')
  })

  it('declares synthetic and no-PHI posture in warning copy', () => {
    expect(warningSrc).toContain('SYNTHETIC DEMO ENVIRONMENT')
    expect(warningSrc).toContain('NO PHI')
  })
})

describe('veridian-care proxy hardening', () => {
  it('stamps request tracing and synthetic security headers', () => {
    expect(proxySrc).toContain("response.headers.set('x-request-id', requestId)")
    expect(proxySrc).toContain("response.headers.set('x-demo-banner', 'synthetic-demo')")
    expect(proxySrc).toContain("response.headers.set('x-phi-mode', 'disabled')")
  })

  it('fails closed for protected routes without access context', () => {
    expect(proxySrc).toContain('if (!isPublicPath(pathname))')
    expect(proxySrc).toContain('ACCESS_CONTEXT_REQUIRED')
    expect(proxySrc).toContain('PROTECTED_ROUTE_DENIED')
    expect(proxySrc).toContain('status: 403')
  })

  it('fails closed for protected routes with invalid access context', () => {
    expect(proxySrc).toContain('ACCESS_CONTEXT_INVALID')
    expect(proxySrc).toContain("accessContext !== VALID_ACCESS_CONTEXT")
  })

  it('keeps health/version endpoints public', () => {
    expect(proxySrc).toContain("'/api/health'")
    expect(proxySrc).toContain("'/api/ready'")
    expect(proxySrc).toContain("'/api/version'")
  })

  it('rejects PHI-marked payloads at the edge', () => {
    expect(proxySrc).toContain('PHI_REJECTED')
    expect(proxySrc).toContain('NO_PHI_ENVIRONMENT')
    expect(proxySrc).toContain('status: 451')
  })

  it('fails closed in production on middleware failure', () => {
    expect(proxySrc).toContain('MIDDLEWARE_FAILURE')
    expect(proxySrc).toContain('status: 503')
  })
})
