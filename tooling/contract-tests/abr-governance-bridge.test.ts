/**
 * Contract Test — ABR Governance Bridge Enforcement
 *
 * ABR Django backend MUST route all audit, evidence, and integration
 * operations through `compliance.governance_bridge` — never directly
 * to ORM models or outbound SDKs.
 *
 * This test statically verifies:
 *   1. The governance bridge module exists with required interface
 *   2. Hand-authored ABR views use the bridge (not raw ORM calls)
 *   3. The bridge validates org_id, audit taxonomy, and entity types
 *   4. Legacy auto-generated views are tracked (known-bypasses list)
 *
 * @invariant ABR_GOVERNANCE_BRIDGE_001: All ABR governance goes through bridge
 * @invariant ABR_GOVERNANCE_BRIDGE_ORG_002: Bridge validates org_id on every op
 * @invariant ABR_GOVERNANCE_BRIDGE_TAXONOMY_003: Bridge enforces ABR audit taxonomy
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const ABR_BACKEND = join(ROOT, 'apps', 'abr', 'backend')

function readContent(rel: string): string {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return ''
  return readFileSync(abs, 'utf-8')
}

function readAbs(abs: string): string {
  if (!existsSync(abs)) return ''
  return readFileSync(abs, 'utf-8')
}

/**
 * Walk Python files in ABR backend, excluding migrations, __pycache__,
 * test files, and the bridge module itself.
 */
function walkPyFiles(
  dir: string,
  exclude: string[] = [],
): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (
        ['__pycache__', 'migrations', 'test_migrations', 'node_modules', '.venv'].includes(
          entry.name,
        )
      )
        continue
      results.push(...walkPyFiles(fullPath, exclude))
    } else if (entry.name.endsWith('.py')) {
      if (exclude.some((e) => fullPath.replace(/\\/g, '/').includes(e))) continue
      results.push(fullPath)
    }
  }
  return results
}

function relPath(fullPath: string): string {
  return fullPath.replace(ROOT, '').replace(/\\/g, '/')
}

// ═══════════════════════════════════════════════════════════════════════════
// ABR_GOVERNANCE_BRIDGE_001 — Bridge module exists with required interface
// ═══════════════════════════════════════════════════════════════════════════

describe('ABR_GOVERNANCE_BRIDGE_001 — Governance bridge module exists', () => {
  const bridgePath = 'apps/abr/backend/compliance/governance_bridge.py'

  it('governance_bridge.py exists in ABR compliance module', () => {
    expect(existsSync(join(ROOT, bridgePath))).toBe(true)
  })

  it('bridge exports a singleton governance object', () => {
    const bridge = readContent(bridgePath)
    expect(bridge).toMatch(/governance\s*=\s*_GovernanceBridge\(\)/)
  })

  it('bridge provides emit_audit method', () => {
    const bridge = readContent(bridgePath)
    expect(bridge).toMatch(/def emit_audit\(/)
  })

  it('bridge provides seal_evidence method', () => {
    const bridge = readContent(bridgePath)
    expect(bridge).toMatch(/def seal_evidence\(/)
  })

  it('bridge provides dispatch_notification method', () => {
    const bridge = readContent(bridgePath)
    expect(bridge).toMatch(/def dispatch_notification\(/)
  })

  it('bridge delegates to create_audit_log (hash-chained audit)', () => {
    const bridge = readContent(bridgePath)
    expect(bridge).toMatch(/from compliance\.services import/)
    expect(bridge).toMatch(/create_audit_log/)
  })

  it('bridge delegates to seal_bundle (evidence lifecycle)', () => {
    const bridge = readContent(bridgePath)
    expect(bridge).toMatch(/seal_bundle/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ABR_GOVERNANCE_BRIDGE_ORG_002 — Bridge validates org_id
// ═══════════════════════════════════════════════════════════════════════════

describe('ABR_GOVERNANCE_BRIDGE_ORG_002 — Org-scoping enforcement', () => {
  const bridgePath = 'apps/abr/backend/compliance/governance_bridge.py'

  it('bridge has org_id validation function', () => {
    const bridge = readContent(bridgePath)
    expect(bridge).toMatch(/_validate_org_id/)
  })

  it('emit_audit validates org_id before delegation', () => {
    const bridge = readContent(bridgePath)
    // The emit_audit method must call _validate_org_id before create_audit_log
    const emitAuditBlock = bridge.slice(
      bridge.indexOf('def emit_audit('),
      bridge.indexOf('def seal_evidence('),
    )
    expect(emitAuditBlock).toMatch(/_validate_org_id/)
  })

  it('seal_evidence validates org_id', () => {
    const bridge = readContent(bridgePath)
    const sealBlock = bridge.slice(
      bridge.indexOf('def seal_evidence('),
      bridge.indexOf('def dispatch_notification('),
    )
    expect(sealBlock).toMatch(/_validate_org_id/)
  })

  it('dispatch_notification validates org_id', () => {
    const bridge = readContent(bridgePath)
    const dispatchBlock = bridge.slice(bridge.indexOf('def dispatch_notification('))
    expect(dispatchBlock).toMatch(/_validate_org_id/)
  })

  it('org_id validation rejects nil UUID', () => {
    const bridge = readContent(bridgePath)
    expect(bridge).toMatch(/nil UUID|int=0/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ABR_GOVERNANCE_BRIDGE_TAXONOMY_003 — Audit taxonomy enforcement
// ═══════════════════════════════════════════════════════════════════════════

describe('ABR_GOVERNANCE_BRIDGE_TAXONOMY_003 — Audit taxonomy enforcement', () => {
  const bridgePath = 'apps/abr/backend/compliance/governance_bridge.py'

  it('bridge defines ABR_AUDIT_ACTIONS matching os-core taxonomy', () => {
    const bridge = readContent(bridgePath)
    expect(bridge).toMatch(/ABR_AUDIT_ACTIONS/)

    // Must include core ABR actions (matching AbrAuditAction in os-core)
    expect(bridge).toContain('CASE_CREATED')
    expect(bridge).toContain('CASE_UPDATED')
    expect(bridge).toContain('CASE_CLOSED')
    expect(bridge).toContain('DECISION_ISSUED')
    expect(bridge).toContain('EVIDENCE_SUBMITTED')
    expect(bridge).toContain('EVIDENCE_SEALED')
    expect(bridge).toContain('EVIDENCE_EXPORTED')
  })

  it('bridge defines ABR_ENTITY_TYPES matching os-core taxonomy', () => {
    const bridge = readContent(bridgePath)
    expect(bridge).toMatch(/ABR_ENTITY_TYPES/)

    expect(bridge).toContain('abr_case')
    expect(bridge).toContain('abr_decision')
    expect(bridge).toContain('abr_evidence_bundle')
  })

  it('emit_audit validates action against taxonomy', () => {
    const bridge = readContent(bridgePath)
    const emitAuditBlock = bridge.slice(
      bridge.indexOf('def emit_audit('),
      bridge.indexOf('def seal_evidence('),
    )
    expect(emitAuditBlock).toMatch(/_validate_audit_action/)
  })

  it('emit_audit validates resource_type against entity types', () => {
    const bridge = readContent(bridgePath)
    const emitAuditBlock = bridge.slice(
      bridge.indexOf('def emit_audit('),
      bridge.indexOf('def seal_evidence('),
    )
    expect(emitAuditBlock).toMatch(/_validate_entity_type/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ABR_GOVERNANCE_BRIDGE_VIEWS_004 — Hand-authored views use bridge
// ═══════════════════════════════════════════════════════════════════════════

describe('ABR_GOVERNANCE_BRIDGE_VIEWS_004 — ABR hand-authored views do not bypass governance', () => {
  // Hand-authored governance-aware views that MUST use the bridge
  // The compliance/abr_views.py is the primary hand-authored module.
  const handAuthoredFiles = ['apps/abr/backend/compliance/abr_views.py']

  // Known legacy auto-generated files that bypass governance.
  // These are tracked and scheduled for migration. Adding new files
  // to this list requires a code review justification.
  // Known legacy auto-generated service views that bypass the governance
  // bridge by calling AuditLogs.objects.create() directly. These are
  // scheduled for migration. Adding a NEW file here requires code review
  // with a justification comment.
  const LEGACY_BYPASS_ALLOWLIST: string[] = [
    // ── Auto-generated service API views (2026-02-18 scaffold batch) ──
    '/services/api/audit_logger_views.py',
    '/services/api/evidence_bundles_views.py',
    '/services/api/compliance_reports_views.py',
    '/services/api/risk_analytics_views.py',
    '/services/api/data_export_views.py',
    '/services/api/ai_quota_views.py',
    '/services/api/ai_training_views.py',
    '/services/api/ai_verification_views.py',
    '/services/api/canlii_ingestion_views.py',
    '/services/api/canlii_rate_limiter_views.py',
    '/services/api/case_alerts_views.py',
    '/services/api/certificates_views.py',
    '/services/api/courses_enhanced_views.py',
    '/services/api/course_gamification_views.py',
    '/services/api/course_workflow_views.py',
    '/services/api/embedding_service_views.py',
    '/services/api/gamification_views.py',
    '/services/api/instructors_views.py',
    '/services/api/lesson_notes_views.py',
    '/services/api/org_offboarding_views.py',
    '/services/api/outcome_prediction_views.py',
    '/services/api/pdf_generator_views.py',
    '/services/api/quiz_questions_views.py',
    '/services/api/quiz_views.py',
    '/services/api/rbac_views.py',
    '/services/api/seat_management_views.py',
    '/services/api/skills_views.py',
    '/services/api/social_views.py',
    '/services/api/sso_views.py',
    '/services/api/tenant_offboarding_views.py',
    // ── Auto-generated CRUD viewsets (read-heavy, minimal mutations) ──
    '/compliance/views.py',
    '/core/views.py',
    '/content/views.py',
    '/billing/views.py',
    '/analytics/views.py',
    '/ai_core/views.py',
    '/notifications/views.py',
    '/auth_core/views.py',
  ]

  it('hand-authored ABR views do not directly call AuditLogs.objects.create()', () => {
    for (const file of handAuthoredFiles) {
      const content = readContent(file)
      if (!content) continue

      // abr_views.py currently uses AbrIdentityAccessLog, not AuditLogs directly
      // This is acceptable as it's a domain-specific immutable access log.
      // What's forbidden is calling AuditLogs.objects.create() which bypasses hash chain.
      const hasDirectAuditCreate = /AuditLogs\.objects\.create\(/.test(content)

      expect(
        hasDirectAuditCreate,
        `${file} directly calls AuditLogs.objects.create() — must use governance.emit_audit()`,
      ).toBe(false)
    }
  })

  it('no NEW Python view files bypass governance outside the legacy allowlist', () => {
    const viewFiles = walkPyFiles(ABR_BACKEND, [
      'governance_bridge.py',
      'services.py',         // the bridge delegates to this
      'models.py',
      'serializers.py',
      'urls.py',
      'apps.py',
      'admin.py',
      '__init__.py',
      'test',                // test files
      'migrations',
    ]).filter((f) => f.includes('views'))

    const violations: string[] = []
    for (const file of viewFiles) {
      const rel = relPath(file)
      const isAllowed = LEGACY_BYPASS_ALLOWLIST.some((a) => rel.includes(a))
      if (isAllowed) continue

      const content = readAbs(file)
      if (/AuditLogs\.objects\.create\(/.test(content)) {
        violations.push(`${rel}: direct AuditLogs.objects.create() — must use governance bridge`)
      }
    }

    expect(
      violations,
      `New view files bypass governance bridge:\n${violations.join('\n')}\n` +
        'If this is intentional legacy code, add to LEGACY_BYPASS_ALLOWLIST with justification.',
    ).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ABR_GOVERNANCE_BRIDGE_DISPATCH_005 — Dispatcher routing enforcement
// ═══════════════════════════════════════════════════════════════════════════

describe('ABR_GOVERNANCE_BRIDGE_DISPATCH_005 — Outbound dispatch goes through bridge', () => {
  const bridgePath = 'apps/abr/backend/compliance/governance_bridge.py'

  it('bridge dispatch_notification sets appId to abr', () => {
    const bridge = readContent(bridgePath)
    const dispatchBlock = bridge.slice(bridge.indexOf('def dispatch_notification('))
    expect(dispatchBlock).toContain('"appId": "abr"')
  })

  it('bridge dispatch_notification includes orgId in envelope', () => {
    const bridge = readContent(bridgePath)
    const dispatchBlock = bridge.slice(bridge.indexOf('def dispatch_notification('))
    expect(dispatchBlock).toContain('"orgId"')
  })
})
