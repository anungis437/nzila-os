/**
 * Contract Test — ABR Governance Bridge Boundary Enforcement
 *
 * Ensures ABR application code (pages, actions, API routes, components)
 * does NOT import directly from platform audit, evidence, or integration
 * packages. All access must go through the governance bridge.
 *
 * Simultaneously validates the TypeScript-side governance bridge module
 * exists with the required interface — matching the Python-side bridge
 * in apps/abr/backend/compliance/governance_bridge.py.
 *
 * @invariant ABR_BRIDGE_BOUNDARY_001: ABR app code uses governance-bridge, not raw platform packages
 * @invariant ABR_BRIDGE_BOUNDARY_002: governance-bridge.ts exists with required interface
 * @invariant ABR_BRIDGE_BOUNDARY_003: Only governance-bridge.ts and evidence-packs.ts may import sealed platform modules
 * @invariant ABR_BRIDGE_BOUNDARY_004: ABR integration-events.ts is dispatcher-only
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const ABR_APP = join(ROOT, 'apps', 'abr')
const ABR_LIB = join(ABR_APP, 'lib')

function readContent(relOrAbs: string): string {
  const abs = relOrAbs.startsWith(ROOT) ? relOrAbs : join(ROOT, relOrAbs)
  if (!existsSync(abs)) return ''
  return readFileSync(abs, 'utf-8')
}

/**
 * Recursively walk TypeScript files in a directory.
 */
function walkTsFiles(
  dir: string,
  exclude: string[] = [],
): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'dist', '__tests__', '.turbo'].includes(entry.name)) continue
      results.push(...walkTsFiles(fullPath, exclude))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      if (exclude.some((e) => fullPath.replace(/\\/g, '/').includes(e))) continue
      results.push(fullPath)
    }
  }
  return results
}

function relPath(fullPath: string): string {
  return relative(ROOT, fullPath).replace(/\\/g, '/')
}

// ── Forbidden direct imports ────────────────────────────────────────────────

/**
 * These import patterns are forbidden in ABR app code (pages, actions,
 * API routes, components). Only the governance bridge and its delegate
 * modules may import from these packages.
 */
const FORBIDDEN_IMPORT_PATTERNS = [
  // Direct audit package access
  /@nzila\/os-core\/audit/,
  /@nzila\/os-core\/evidence/,
  // Direct integration SDK access
  /@nzila\/integrations-core/,
  /@nzila\/integrations-runtime/,
  // Direct commerce audit/evidence (ABR should use os-core, not commerce)
  /@nzila\/commerce-audit/,
  /@nzila\/commerce-evidence/,
]

/**
 * Files that are ALLOWED to import from the forbidden packages.
 * These are the governance bridge and its immediate delegate modules.
 */
const BRIDGE_ALLOWLIST = [
  'apps/abr/lib/governance-bridge.ts',
  'apps/abr/lib/evidence-packs.ts',
  'apps/abr/lib/evidence.ts',
  'apps/abr/lib/integration-events.ts',
]

// ═════════════════════════════════════════════════════════════════════════════
// ABR_BRIDGE_BOUNDARY_001 — App code must not bypass governance bridge
// ═════════════════════════════════════════════════════════════════════════════

describe('ABR_BRIDGE_BOUNDARY_001 — ABR app code uses governance-bridge, not raw platform packages', () => {
  // Scan ABR app directories that contain application code
  const appDirs = [
    join(ABR_APP, 'app'),       // Next.js app router (pages, layouts, API routes)
    join(ABR_APP, 'components'),// React components
  ]

  it('no ABR page/component/API route imports directly from audit/evidence/integrations packages', () => {
    const violations: string[] = []

    for (const dir of appDirs) {
      const files = walkTsFiles(dir)
      for (const file of files) {
        const rel = relPath(file)
        const content = readContent(file)

        for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
          if (pattern.test(content)) {
            violations.push(`${rel}: imports ${pattern.source} directly — must use governance-bridge`)
          }
        }
      }
    }

    expect(
      violations,
      `ABR app code bypasses governance bridge:\n${violations.join('\n')}\n` +
        'All audit/evidence/integration access must go through apps/abr/lib/governance-bridge.ts',
    ).toEqual([])
  })

  it('ABR lib files outside the bridge allowlist do not import from protected packages', () => {
    const libFiles = walkTsFiles(ABR_LIB)
    const violations: string[] = []

    for (const file of libFiles) {
      const rel = relPath(file)
      if (BRIDGE_ALLOWLIST.includes(rel)) continue

      const content = readContent(file)
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${rel}: imports ${pattern.source} — only bridge modules may do this`)
        }
      }
    }

    expect(
      violations,
      `ABR lib files bypass governance bridge:\n${violations.join('\n')}\n` +
        `Only these files may import from protected packages:\n${BRIDGE_ALLOWLIST.join('\n')}`,
    ).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// ABR_BRIDGE_BOUNDARY_002 — governance-bridge.ts exists with required interface
// ═════════════════════════════════════════════════════════════════════════════

describe('ABR_BRIDGE_BOUNDARY_002 — Governance bridge module exists with required interface', () => {
  const bridgePath = 'apps/abr/lib/governance-bridge.ts'

  it('governance-bridge.ts exists', () => {
    expect(existsSync(join(ROOT, bridgePath))).toBe(true)
  })

  it('exports emitAudit function', () => {
    const content = readContent(bridgePath)
    expect(content).toMatch(/export function emitAudit\(/)
  })

  it('exports triggerEvidence function', () => {
    const content = readContent(bridgePath)
    expect(content).toMatch(/export async function triggerEvidence\(/)
  })

  it('exports validateOrgContext function', () => {
    const content = readContent(bridgePath)
    expect(content).toMatch(/export function validateOrgContext\(/)
  })

  it('exports validateAuditAction function', () => {
    const content = readContent(bridgePath)
    expect(content).toMatch(/export function validateAuditAction\(/)
  })

  it('exports validateEntityType function', () => {
    const content = readContent(bridgePath)
    expect(content).toMatch(/export function validateEntityType\(/)
  })

  it('exports OrgContextError class', () => {
    const content = readContent(bridgePath)
    expect(content).toMatch(/export class OrgContextError/)
  })

  it('exports AuditTaxonomyError class', () => {
    const content = readContent(bridgePath)
    expect(content).toMatch(/export class AuditTaxonomyError/)
  })

  it('emitAudit calls validateOrgContext before building event', () => {
    const content = readContent(bridgePath)
    const emitBlock = content.slice(
      content.indexOf('export function emitAudit('),
      content.indexOf('export async function triggerEvidence('),
    )
    expect(emitBlock).toContain('validateOrgContext')
    expect(emitBlock).toContain('validateAuditAction')
    expect(emitBlock).toContain('validateEntityType')
  })

  it('triggerEvidence calls validateOrgContext', () => {
    const content = readContent(bridgePath)
    const triggerBlock = content.slice(
      content.indexOf('export async function triggerEvidence('),
    )
    expect(triggerBlock).toContain('validateOrgContext')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// ABR_BRIDGE_BOUNDARY_003 — Only bridge modules import sealed platform APIs
// ═════════════════════════════════════════════════════════════════════════════

describe('ABR_BRIDGE_BOUNDARY_003 — Sealed platform imports restricted to bridge modules', () => {
  it('governance-bridge.ts imports from os-core audit', () => {
    const content = readContent('apps/abr/lib/governance-bridge.ts')
    expect(content).toMatch(/@nzila\/os-core\/audit\/abr/)
  })

  it('governance-bridge.ts imports from os-core evidence/seal', () => {
    const content = readContent('apps/abr/lib/governance-bridge.ts')
    expect(content).toMatch(/@nzila\/os-core\/evidence\/seal/)
  })

  it('governance-bridge.ts delegates to evidence-packs.ts', () => {
    const content = readContent('apps/abr/lib/governance-bridge.ts')
    expect(content).toMatch(/from '\.\/evidence-packs'/)
  })

  it('governance-bridge.ts delegates to integration-events.ts', () => {
    const content = readContent('apps/abr/lib/governance-bridge.ts')
    expect(content).toMatch(/from '\.\/integration-events'/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// ABR_BRIDGE_BOUNDARY_004 — Dispatcher-only integration enforcement
// ═════════════════════════════════════════════════════════════════════════════

describe('ABR_BRIDGE_BOUNDARY_004 — ABR uses dispatcher-only integration', () => {
  it('integration-events.ts builds SendRequest objects (not direct SDK calls)', () => {
    const content = readContent('apps/abr/lib/integration-events.ts')
    expect(content).toContain('buildAbrSendRequest')
    expect(content).toContain('IntegrationDispatcher')
  })

  it('integration-events.ts does not import from email/SMS/webhook SDKs directly', () => {
    const content = readContent('apps/abr/lib/integration-events.ts')
    // These would indicate direct SDK usage instead of dispatcher
    expect(content).not.toMatch(/@nzila\/comms-email/)
    expect(content).not.toMatch(/@nzila\/comms-sms/)
    expect(content).not.toMatch(/@nzila\/comms-push/)
    expect(content).not.toMatch(/@nzila\/crm-hubspot/)
  })

  it('no ABR app code imports from comms packages directly', () => {
    const violations: string[] = []
    const commsPkgPatterns = [
      /@nzila\/comms-email/,
      /@nzila\/comms-sms/,
      /@nzila\/comms-push/,
      /@nzila\/crm-hubspot/,
    ]

    const appDirs = [
      join(ABR_APP, 'app'),
      join(ABR_APP, 'components'),
      join(ABR_APP, 'lib'),
    ]

    for (const dir of appDirs) {
      const files = walkTsFiles(dir)
      for (const file of files) {
        const rel = relPath(file)
        const content = readContent(file)
        for (const pattern of commsPkgPatterns) {
          if (pattern.test(content)) {
            violations.push(
              `${rel}: imports ${pattern.source} — must use dispatcher via governance-bridge`,
            )
          }
        }
      }
    }

    expect(violations, 'ABR app code uses direct comms SDKs').toEqual([])
  })
})
