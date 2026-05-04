import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../..')
const layoutSrc = readFileSync(resolve(__dirname, '../app/layout.tsx'), 'utf8')
const proxySrc = readFileSync(resolve(__dirname, '../proxy.ts'), 'utf8')
const fixtureSrc = readFileSync(resolve(ROOT, 'apps/veridian-care/lib/synthetic-patients.ts'), 'utf8')
const inventorySrc = readFileSync(
  resolve(ROOT, 'governance/release/deployment-inventory.json'),
  'utf8',
)
const inventory = JSON.parse(inventorySrc) as {
  apps: Record<
    string,
    {
      releaseStatus?: string
      prodPromotionEligible?: boolean
      requiresExplicitProdOverride?: boolean
      track?: string
      productionReadiness?: { state?: string; mitigation?: string }
      routing?: { production?: string }
    }
  >
}

describe('veridian-admin synthetic no-PHI posture', () => {
  it('renders synthetic no-PHI warning in root layout', () => {
    expect(layoutSrc).toContain('SYNTHETIC DEMO ENVIRONMENT')
    expect(layoutSrc).toContain('NO PHI')
  })
})

describe('veridian-admin proxy hardening', () => {
  it('stamps request tracing and synthetic security headers', () => {
    expect(proxySrc).toContain("response.headers.set('x-request-id', requestId)")
    expect(proxySrc).toContain("response.headers.set('x-demo-banner', 'internal-demo')")
    expect(proxySrc).toContain("response.headers.set('x-phi-mode', 'disabled')")
  })

  it('fails closed for protected routes without access context', () => {
    expect(proxySrc).toContain('if (!isPublicPath(pathname))')
    expect(proxySrc).toContain('ACCESS_CONTEXT_REQUIRED')
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

  it('fails closed in production on middleware failure', () => {
    expect(proxySrc).toContain('MIDDLEWARE_FAILURE')
    expect(proxySrc).toContain('status: 503')
  })
})

describe('veridian synthetic fixture hygiene', () => {
  it('keeps fixture posture explicitly synthetic/demo scoped', () => {
    expect(fixtureSrc).toContain('SYNTHETIC DEMO DATA ONLY')
    expect(fixtureSrc).toContain("organizationId: 'demo-org'")
    expect(fixtureSrc).toContain("siteId: 'demo-site'")
    expect(fixtureSrc).toContain("environment: 'demo'")
    expect(fixtureSrc).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/)
    expect(fixtureSrc).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  })

  it('does not introduce PHI-like patterns in veridian regression tests', () => {
    const testFiles = [
      resolve(ROOT, 'apps/veridian-site/lib/security-regression.test.ts'),
      resolve(ROOT, 'apps/veridian-care/lib/security-regression.test.ts'),
      resolve(ROOT, 'apps/veridian-site/lib/smoke.test.ts'),
      resolve(ROOT, 'apps/veridian-care/lib/smoke.test.ts'),
      resolve(ROOT, 'apps/veridian-admin/lib/smoke.test.ts'),
    ]

    const bannedPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/,
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
      /\b(?:SSN|Social Security Number)\b/i,
    ]

    for (const file of testFiles) {
      const src = readFileSync(file, 'utf8')
      for (const pattern of bannedPatterns) {
        expect(src).not.toMatch(pattern)
      }
    }
  })
})

describe('veridian deployment inventory alignment', () => {
  const veridianApps = ['veridian-site', 'veridian-care', 'veridian-admin'] as const

  for (const appName of veridianApps) {
    it(`${appName} remains staging-demo and production-gated`, () => {
      const app = inventory.apps[appName]
      expect(app).toBeDefined()
      expect(app.releaseStatus).toBe('staging-only')
      expect(app.track).toBe('pilot')
      expect(app.prodPromotionEligible).toBe(false)
      expect(app.requiresExplicitProdOverride).toBe(true)
      expect(app.routing?.production).toBe('blocked')
      expect(app.productionReadiness?.mitigation ?? '').toMatch(/synthetic|no live PHI|demo/i)
    })
  }
})
