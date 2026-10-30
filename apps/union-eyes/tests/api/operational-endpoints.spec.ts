import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Operational Endpoint Contract Tests
 *
 * Validates the shape and implementation contracts for three UE operational endpoints:
 *   /api/health            — RuntimeHealthResponse canonical shape
 *   /api/governance/telemetry — governance telemetry shape
 *   /api/evidence/export   — procurement-safe evidence pack shape
 *
 * These are static fixture + source-analysis tests; no live DB or network calls.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function readRoute(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8')
}

// ─── Fixture: expected RuntimeHealthResponse contract shape ─────────────────

const HEALTH_RESPONSE_OK: Record<string, unknown> = {
  ok: true,
  status: 'healthy',
  app: 'union-eyes',
  environment: 'staging',
  version: '1.0.0',
  timestamp: '2025-01-01T00:00:00.000Z',
  checks: {
    process: { status: 'ok' },
    database: { status: 'ok', critical: true, ms: 12 },
    auth: { status: 'ok', critical: true },
    redis: { status: 'ok', ms: 4 },
    backend: { status: 'ok', ms: 22 },
  },
}

const HEALTH_RESPONSE_DEGRADED: Record<string, unknown> = {
  ok: true,
  status: 'degraded',
  app: 'union-eyes',
  environment: 'staging',
  version: '1.0.0',
  timestamp: '2025-01-01T00:00:00.000Z',
  checks: {
    process: { status: 'ok' },
    database: { status: 'ok', critical: true, ms: 10 },
    auth: { status: 'ok', critical: true },
    redis: { status: 'degraded', note: 'Redis URL or token missing' },
    backend: { status: 'ok', note: 'Django backend not configured — optional', ms: 0 },
  },
}

const HEALTH_RESPONSE_FAILING: Record<string, unknown> = {
  ok: false,
  status: 'failing',
  app: 'union-eyes',
  environment: 'staging',
  version: '1.0.0',
  timestamp: '2025-01-01T00:00:00.000Z',
  checks: {
    process: { status: 'ok' },
    database: { status: 'fail', critical: true, error: 'Connection refused' },
    auth: { status: 'ok', critical: true },
    redis: { status: 'ok', ms: 4 },
    backend: { status: 'ok', ms: 18 },
  },
}

// ─── Fixture: governance telemetry contract shape ────────────────────────────

const GOVERNANCE_TELEMETRY_RESPONSE = {
  policy_denied_count: 3,
  workflow_transition_error_count: 1,
  audit_event_volume: 142,
  evidence_export_count: 7,
  auth_anomaly_count: 0,
  generated_at: '2025-01-01T00:00:00.000Z',
}

// ─── Fixture: evidence export contract shape ─────────────────────────────────

const EVIDENCE_EXPORT_UNAVAILABLE = {
  app: 'union-eyes',
  org_id: '11111111-1111-4111-8111-111111111111',
  status: 'not_attested',
  verified: false,
  error: 'VERIFIED_EVIDENCE_UNAVAILABLE',
  sbom: { status: 'not_attested', artifact: null },
  policy_checks: { status: 'not_attested', results: null },
  org_isolation: { status: 'not_attested', results: null },
  build: { status: 'not_attested', commit: null, timestamp: null },
}

// ─────────────────────────────────────────────────────────────────────────────
// Health endpoint contract tests
// ─────────────────────────────────────────────────────────────────────────────

describe('UE Ops - /api/health response contract', () => {
  it('ok=true when status is healthy (HEALTH-OK-FLAG-HEALTHY)', () => {
    expect(HEALTH_RESPONSE_OK.ok).toBe(true)
    expect(HEALTH_RESPONSE_OK.status).toBe('healthy')
  })

  it('ok=true when status is degraded — degraded is not an outage (HEALTH-DEGRADED-NOT-OUTAGE)', () => {
    expect(HEALTH_RESPONSE_DEGRADED.ok).toBe(true)
    expect(HEALTH_RESPONSE_DEGRADED.status).toBe('degraded')
  })

  it('ok=false when status is failing — failing maps to HTTP 503 (HEALTH-FAILING-HTTP-503)', () => {
    expect(HEALTH_RESPONSE_FAILING.ok).toBe(false)
    expect(HEALTH_RESPONSE_FAILING.status).toBe('failing')
  })

  it('response always carries app, environment, version, timestamp (HEALTH-REQUIRED-FIELDS)', () => {
    for (const fixture of [HEALTH_RESPONSE_OK, HEALTH_RESPONSE_DEGRADED, HEALTH_RESPONSE_FAILING]) {
      expect(typeof fixture.app).toBe('string')
      expect((fixture.app as string).length).toBeGreaterThan(0)
      expect(typeof fixture.environment).toBe('string')
      expect(typeof fixture.version).toBe('string')
      expect(typeof fixture.timestamp).toBe('string')
    }
  })

  it('checks map always has process, database, auth entries (HEALTH-REQUIRED-CHECKS)', () => {
    for (const fixture of [HEALTH_RESPONSE_OK, HEALTH_RESPONSE_DEGRADED, HEALTH_RESPONSE_FAILING]) {
      const checks = fixture.checks as Record<string, unknown>
      expect(checks).toHaveProperty('process')
      expect(checks).toHaveProperty('database')
      expect(checks).toHaveProperty('auth')
    }
  })

  it('database check is marked critical (HEALTH-DB-CRITICAL)', () => {
    const dbOk = (HEALTH_RESPONSE_OK.checks as Record<string, Record<string, unknown>>).database
    expect(dbOk.critical).toBe(true)
    const dbFail = (HEALTH_RESPONSE_FAILING.checks as Record<string, Record<string, unknown>>).database
    expect(dbFail.critical).toBe(true)
  })

  it('failing database check carries error field (HEALTH-DB-FAIL-ERROR-FIELD)', () => {
    const db = (HEALTH_RESPONSE_FAILING.checks as Record<string, Record<string, unknown>>).database
    expect(db.status).toBe('fail')
    expect(typeof db.error).toBe('string')
  })

  it('degraded redis check carries note field (HEALTH-REDIS-DEGRADED-NOTE)', () => {
    const redis = (HEALTH_RESPONSE_DEGRADED.checks as Record<string, Record<string, unknown>>).redis
    expect(redis.status).toBe('degraded')
    expect(typeof redis.note).toBe('string')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Health route source analysis
// ─────────────────────────────────────────────────────────────────────────────

describe('UE Ops - /api/health source implementation contract', () => {
  const healthSrc = readRoute('app/api/health/route.ts')

  it('uses buildRuntimeHealthResponse as the runtime health contract (HEALTH-USES-RUNTIME-CONTRACT)', () => {
    expect(healthSrc).toContain('buildRuntimeHealthResponse')
  })

  it('database check is flagged critical:true (HEALTH-DB-CRITICAL-FLAG-IN-SOURCE)', () => {
    expect(healthSrc).toMatch(/critical:\s*true/)
  })

  it('returns 503 when ok is false (HEALTH-503-ON-FAIL)', () => {
    expect(healthSrc).toContain('payload.ok ? 200 : 503')
  })

  it('probes Redis if configured (HEALTH-REDIS-PROBE)', () => {
    expect(healthSrc).toContain('UPSTASH_REDIS_REST_URL')
  })

  it('probes auth configuration (HEALTH-AUTH-PROBE)', () => {
    expect(healthSrc).toContain('AUTH_SECRET')
  })

  it('fails closed when catalog authority drifts (HEALTH-CATALOG-ADMISSION)', () => {
    expect(healthSrc).toContain('evaluateCatalogAdmission')
    expect(healthSrc).toContain('catalogAuthority')
    expect(healthSrc).toMatch(/catalogAuthority:[\s\S]*critical:\s*true/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Governance telemetry contract tests
// ─────────────────────────────────────────────────────────────────────────────

describe('UE Ops - /api/governance/telemetry response contract', () => {
  it('response carries all required governance counters (GOV-TELEMETRY-REQUIRED-FIELDS)', () => {
    const required = [
      'policy_denied_count',
      'workflow_transition_error_count',
      'audit_event_volume',
      'evidence_export_count',
      'auth_anomaly_count',
      'generated_at',
    ] as const
    for (const field of required) {
      expect(GOVERNANCE_TELEMETRY_RESPONSE).toHaveProperty(field)
    }
  })

  it('all counters are non-negative numbers (GOV-TELEMETRY-COUNTER-TYPE)', () => {
    const counters = [
      'policy_denied_count',
      'workflow_transition_error_count',
      'audit_event_volume',
      'evidence_export_count',
      'auth_anomaly_count',
    ] as const
    for (const counter of counters) {
      expect(typeof GOVERNANCE_TELEMETRY_RESPONSE[counter]).toBe('number')
      expect(GOVERNANCE_TELEMETRY_RESPONSE[counter]).toBeGreaterThanOrEqual(0)
    }
  })

  it('generated_at is an ISO 8601 timestamp (GOV-TELEMETRY-TIMESTAMP)', () => {
    expect(GOVERNANCE_TELEMETRY_RESPONSE.generated_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    )
  })
})

describe('UE Ops - /api/governance/telemetry source implementation contract', () => {
  const telemetrySrc = readRoute('app/api/governance/telemetry/route.ts')

  it('exports recordPolicyDenied counter helper (GOV-TELEMETRY-EXPORTS-HELPERS)', () => {
    expect(telemetrySrc).toContain('recordPolicyDenied')
  })

  it('exports recordWorkflowTransitionError counter helper (GOV-TELEMETRY-EXPORTS-TRANSITION-ERROR)', () => {
    expect(telemetrySrc).toContain('recordWorkflowTransitionError')
  })

  it('exports recordEvidenceExport counter helper (GOV-TELEMETRY-EXPORTS-EVIDENCE-EXPORT)', () => {
    expect(telemetrySrc).toContain('recordEvidenceExport')
  })

  it('response includes generated_at timestamp (GOV-TELEMETRY-GENERATED-AT)', () => {
    expect(telemetrySrc).toContain('generated_at')
  })

  it('policy_denied_count derives from real DB query or in-process counter (GOV-TELEMETRY-REAL-POLICY-COUNT)', () => {
    expect(telemetrySrc).toMatch(/policyEvaluations|policyDeniedCounter/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Evidence export contract tests
// ─────────────────────────────────────────────────────────────────────────────

describe('UE Ops - /api/evidence/export unavailable contract', () => {
  const exportSrc = readRoute('app/api/evidence/export/route.ts')

  it('never asserts unverified evidence as genuine', () => {
    expect(EVIDENCE_EXPORT_UNAVAILABLE.verified).toBe(false)
    expect(EVIDENCE_EXPORT_UNAVAILABLE.status).toBe('not_attested')
    expect(EVIDENCE_EXPORT_UNAVAILABLE.sbom.artifact).toBeNull()
    expect(EVIDENCE_EXPORT_UNAVAILABLE.policy_checks.results).toBeNull()
    expect(EVIDENCE_EXPORT_UNAVAILABLE.org_isolation.results).toBeNull()
  })

  it('requires authenticated officer authorization through the canonical API framework', () => {
    expect(exportSrc).toContain("auth: { minRole: 'officer' }")
    expect(exportSrc).toContain('requireOrg: true')
  })

  it('rejects a caller-selected organization different from the verified session', () => {
    expect(exportSrc).toContain('requestedOrg !== organizationId')
    expect(exportSrc).toContain('ApiError.forbidden')
  })

  it('persists an actor- and organization-scoped audit before refusing the export', () => {
    expect(exportSrc).toContain('withRLSContext({ organizationId, userId }')
    expect(exportSrc).toContain('persistAtomicAudit(tx')
    expect(exportSrc).toContain("action: 'evidence.export.unavailable'")
  })

  it('returns HTTP 503 with no-store instead of a fabricated successful evidence pack', () => {
    expect(exportSrc).toContain('status: 503')
    expect(exportSrc).toContain("'Cache-Control': 'private, no-store'")
    expect(exportSrc).toContain('VERIFIED_EVIDENCE_UNAVAILABLE')
    expect(exportSrc).toContain("org_isolation: { status: 'not_attested', results: null }")
    expect(exportSrc).not.toContain('enforced: true')
  })
})
