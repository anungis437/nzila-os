import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const layoutSrc = readFileSync(resolve(__dirname, '../app/layout.tsx'), 'utf8')
const warningSrc = readFileSync(resolve(__dirname, '../components/synthetic-warning.tsx'), 'utf8')
const proxySrc = readFileSync(resolve(__dirname, '../proxy.ts'), 'utf8')

describe('veridian-site synthetic no-PHI posture', () => {
  it('renders synthetic warning banner from root layout', () => {
    expect(layoutSrc).toContain('<SyntheticWarning />')
  })

  it('declares synthetic and no-PHI posture in the banner copy', () => {
    expect(warningSrc).toContain('SYNTHETIC DEMO ENVIRONMENT')
    expect(warningSrc).toContain('NO PHI')
  })
})

describe('veridian-site proxy hardening', () => {
  it('stamps request tracing and synthetic demo headers', () => {
    expect(proxySrc).toContain("response.headers.set('x-request-id', requestId)")
    expect(proxySrc).toContain("response.headers.set('x-demo-banner', 'synthetic-demo')")
  })

  it('fails closed in production on middleware failure', () => {
    expect(proxySrc).toContain('MIDDLEWARE_FAILURE')
    expect(proxySrc).toContain('status: 503')
  })

  it('keeps public marketing routes accessible without access-context guard', () => {
    expect(proxySrc).toContain('matcher: [')
    expect(proxySrc).not.toContain('ACCESS_CONTEXT_REQUIRED')
    expect(proxySrc).not.toContain('PROTECTED_ROUTE_DENIED')
  })
})
