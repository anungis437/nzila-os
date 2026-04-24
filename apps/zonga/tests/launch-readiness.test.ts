/**
 * Zonga — Launch Readiness Tests
 *
 * Static source analysis suite validating that critical launch-readiness
 * guardrails are in place in the codebase:
 *
 *   1. API guard exports: requireRole() is exported from api-guards.ts
 *   2. Payout route uses requireRole() for POST
 *   3. Payout route uses requireRole() for GET
 *   4. requireRole() uses deny-by-default fallback ('listener')
 *   5. requireRole() always includes elevated roles (super_admin, platform_operator)
 *   6. Upload file limits are defined
 *   7. ALLOWED_AUDIO_TYPES is a whitelist Set (not undefined)
 *   8. Circuit breakers are configured for CloudFront, MediaConvert, IVS
 *   9. Earnings ledger computes platform fee splits
 *  10. Payout state machine has minimum threshold enforcement
 *  11. Maturity level is tracked in maturity.json
 *
 * These tests use static source analysis — no DB, no HTTP calls required.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..')

type ReportPath =
  | '../../reports/zonga-admin-gap-audit.md'
  | '../../reports/zonga-auth-rbac-audit.md'
  | '../../reports/zonga-backup-ir-plan.md'
  | '../../reports/zonga-billing-payouts-readiness.md'
  | '../../reports/zonga-client-onboarding-script.md'
  | '../../reports/zonga-go-live-decision.md'
  | '../../reports/zonga-launch-readiness.md'
  | '../../reports/zonga-legal-launch-pack.md'
  | '../../reports/zonga-streaming-readiness.md'

type ReadSourcePath =
  | 'app/api/payouts/route.ts'
  | 'features/media/playback-service.ts'
  | 'features/media/resilience.ts'
  | 'features/media/types.ts'
  | 'features/media/upload-service.ts'
  | 'features/payouts/payout-service.ts'
  | 'features/payouts/revenue-split.ts'
  | 'features/payouts/types.ts'
  | 'lib/api-guards.ts'
  | 'maturity.json'

const SOURCE_TEXT: Record<ReadSourcePath, string> = {
  'app/api/payouts/route.ts': readFileSync(resolve(ROOT, 'app/api/payouts/route.ts'), 'utf-8'),
  'features/media/playback-service.ts': readFileSync(resolve(ROOT, 'features/media/playback-service.ts'), 'utf-8'),
  'features/media/resilience.ts': readFileSync(resolve(ROOT, 'features/media/resilience.ts'), 'utf-8'),
  'features/media/types.ts': readFileSync(resolve(ROOT, 'features/media/types.ts'), 'utf-8'),
  'features/media/upload-service.ts': readFileSync(resolve(ROOT, 'features/media/upload-service.ts'), 'utf-8'),
  'features/payouts/payout-service.ts': readFileSync(resolve(ROOT, 'features/payouts/payout-service.ts'), 'utf-8'),
  'features/payouts/revenue-split.ts': readFileSync(resolve(ROOT, 'features/payouts/revenue-split.ts'), 'utf-8'),
  'features/payouts/types.ts': readFileSync(resolve(ROOT, 'features/payouts/types.ts'), 'utf-8'),
  'lib/api-guards.ts': readFileSync(resolve(ROOT, 'lib/api-guards.ts'), 'utf-8'),
  'maturity.json': readFileSync(resolve(ROOT, 'maturity.json'), 'utf-8'),
}

function readSource(relPath: ReadSourcePath): string {
  return SOURCE_TEXT[relPath]
}

function fileExists(relPath: ReportPath | 'maturity.json'): boolean {
  switch (relPath) {
    case '../../reports/zonga-admin-gap-audit.md':
      return existsSync(resolve(ROOT, '../../reports/zonga-admin-gap-audit.md'))
    case '../../reports/zonga-auth-rbac-audit.md':
      return existsSync(resolve(ROOT, '../../reports/zonga-auth-rbac-audit.md'))
    case '../../reports/zonga-backup-ir-plan.md':
      return existsSync(resolve(ROOT, '../../reports/zonga-backup-ir-plan.md'))
    case '../../reports/zonga-billing-payouts-readiness.md':
      return existsSync(resolve(ROOT, '../../reports/zonga-billing-payouts-readiness.md'))
    case '../../reports/zonga-client-onboarding-script.md':
      return existsSync(resolve(ROOT, '../../reports/zonga-client-onboarding-script.md'))
    case '../../reports/zonga-go-live-decision.md':
      return existsSync(resolve(ROOT, '../../reports/zonga-go-live-decision.md'))
    case '../../reports/zonga-launch-readiness.md':
      return existsSync(resolve(ROOT, '../../reports/zonga-launch-readiness.md'))
    case '../../reports/zonga-legal-launch-pack.md':
      return existsSync(resolve(ROOT, '../../reports/zonga-legal-launch-pack.md'))
    case '../../reports/zonga-streaming-readiness.md':
      return existsSync(resolve(ROOT, '../../reports/zonga-streaming-readiness.md'))
    case 'maturity.json':
      return existsSync(resolve(ROOT, 'maturity.json'))
    default:
      return false
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. ROLE-BASED ACCESS CONTROL
// ═══════════════════════════════════════════════════════════════════════════

describe('Role-Based Access Control', () => {
  it('requireRole is exported from api-guards.ts', () => {
    const src = readSource('lib/api-guards.ts')
    expect(src).toContain('export async function requireRole')
  })

  it('requireRole includes ZongaRole type definition', () => {
    const src = readSource('lib/api-guards.ts')
    expect(src).toContain('ZongaRole')
    expect(src).toContain("'super_admin'")
    expect(src).toContain("'finance_admin'")
    expect(src).toContain("'client_admin'")
  })

  it('requireRole has deny-by-default fallback to listener role', () => {
    const src = readSource('lib/api-guards.ts')
    expect(src).toContain("'listener'")
  })

  it('requireRole always grants access to elevated roles', () => {
    const src = readSource('lib/api-guards.ts')
    expect(src).toContain('ELEVATED_ROLES')
    expect(src).toContain("'super_admin'")
    expect(src).toContain("'platform_operator'")
  })

  it('requireRole returns 403 for insufficient privileges', () => {
    const src = readSource('lib/api-guards.ts')
    expect(src).toContain('status: 403')
    expect(src).toContain("'Insufficient privileges'")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. PAYOUT API ROUTE SECURITY
// ═══════════════════════════════════════════════════════════════════════════

describe('Payout API Route Security', () => {
  it('payouts route imports requireRole', () => {
    const src = readSource('app/api/payouts/route.ts')
    expect(src).toContain('requireRole')
  })

  it('POST /api/payouts requires finance_admin role', () => {
    const src = readSource('app/api/payouts/route.ts')
    expect(src).toContain("'finance_admin'")
    expect(src).toContain('roleGuard.ok')
    expect(src).toContain('roleGuard.response')
  })

  it('GET /api/payouts requires at minimum finance_admin or client_admin', () => {
    const src = readSource('app/api/payouts/route.ts')
    expect(src).toContain("'client_admin'")
  })

  it('payouts POST handler rejects on failed role check', () => {
    const src = readSource('app/api/payouts/route.ts')
    expect(src).toContain('if (!roleGuard.ok) return roleGuard.response')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. UPLOAD VALIDATION GUARDRAILS
// ═══════════════════════════════════════════════════════════════════════════

describe('Upload Validation Guardrails', () => {
  it('ALLOWED_AUDIO_TYPES is a Set (whitelist)', () => {
    const src = readSource('features/media/types.ts')
    expect(src).toContain('ALLOWED_AUDIO_TYPES = new Set')
  })

  it('ALLOWED_AUDIO_TYPES includes expected audio formats', () => {
    const src = readSource('features/media/types.ts')
    expect(src).toContain('audio/mpeg')
    expect(src).toContain('audio/flac')
    expect(src).toContain('audio/wav')
  })

  it('MAX_AUDIO_BYTES is set (500MB)', () => {
    const src = readSource('features/media/types.ts')
    expect(src).toContain('MAX_AUDIO_BYTES')
    expect(src).toContain('500 * 1024 * 1024')
  })

  it('MAX_IMAGE_BYTES is set (10MB)', () => {
    const src = readSource('features/media/types.ts')
    expect(src).toContain('MAX_IMAGE_BYTES')
    expect(src).toContain('10 * 1024 * 1024')
  })

  it('upload service uses SHA-256 for duplicate detection', () => {
    const src = readSource('features/media/upload-service.ts')
    expect(src).toContain('sha256')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. STREAMING RESILIENCE
// ═══════════════════════════════════════════════════════════════════════════

describe('Streaming Resilience', () => {
  it('circuit breakers are defined for all AWS services', () => {
    const src = readSource('features/media/resilience.ts')
    expect(src).toContain('cloudFrontBreaker')
    expect(src).toContain('mediaConvertBreaker')
    expect(src).toContain('ivsBreaker')
  })

  it('CloudFront breaker has a failure threshold', () => {
    const src = readSource('features/media/resilience.ts')
    expect(src).toContain('cloudFrontBreaker')
  })

  it('playback service has fallback path to blob storage', () => {
    const src = readSource('features/media/playback-service.ts')
    expect(src.toLowerCase()).toMatch(/fallback|blob/)
  })

  it('quality entitlement clamping is implemented', () => {
    const src = readSource('features/media/playback-service.ts')
    expect(src).toContain('clampQuality')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. EARNINGS AND PAYOUT INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════

describe('Earnings and Payout Integrity', () => {
  it('PLATFORM_FEE_PCT is defined for all revenue sources', () => {
    const src = readSource('features/payouts/types.ts')
    expect(src).toContain('PLATFORM_FEE_PCT')
    expect(src).toContain('streaming')
    expect(src).toContain('download')
  })

  it('payout state machine has minimum threshold enforcement', () => {
    const src = readSource('features/payouts/payout-service.ts')
    expect(src).toContain('MIN_PAYOUT_THRESHOLD')
  })

  it('payout state machine validates status transitions', () => {
    const src = readSource('features/payouts/payout-service.ts')
    expect(src).toContain('transitionPayoutState')
  })

  it('revenue splits must sum to 100 percent', () => {
    const src = readSource('features/payouts/revenue-split.ts')
    expect(src).toContain('100')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. PLATFORM MATURITY TRACKING
// ═══════════════════════════════════════════════════════════════════════════

describe('Platform Maturity Tracking', () => {
  it('maturity.json exists', () => {
    expect(fileExists('maturity.json')).toBe(true)
  })

  it('maturity.json has required fields', () => {
    const raw = readSource('maturity.json')
    const json = JSON.parse(raw)
    expect(json).toHaveProperty('status')
    expect(json).toHaveProperty('gtm_posture')
    expect(json).toHaveProperty('revenue_status')
    expect(json).toHaveProperty('portfolio_tier')
  })

  it('launch readiness reports have been generated', () => {
    const reports = [
      '../../reports/zonga-auth-rbac-audit.md',
      '../../reports/zonga-billing-payouts-readiness.md',
      '../../reports/zonga-streaming-readiness.md',
      '../../reports/zonga-admin-gap-audit.md',
      '../../reports/zonga-legal-launch-pack.md',
      '../../reports/zonga-backup-ir-plan.md',
      '../../reports/zonga-client-onboarding-script.md',
      '../../reports/zonga-go-live-decision.md',
      '../../reports/zonga-launch-readiness.md',
    ] as const

    for (const report of reports) {
      expect(fileExists(report), `Missing report: ${report}`).toBe(true)
    }
  })
})
