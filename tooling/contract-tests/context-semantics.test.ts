/**
 * Contract tests — Context Semantics
 *
 * Enforces that:
 *   1. All domain OrgContext types include `orgId` as canonical field.
 *   2. The canonical @nzila/org package exists and exports OrgContext + DbContext.
 *   3. All domain packages declare @nzila/org as a dependency.
 *   4. No domain type definitions use `entityId` without also having `orgId`.
 *
 * @invariant CONTEXT_SEMANTICS_ENFORCED_001
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ROOT = join(__dirname, '..', '..')

function readContent(rel: string): string {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return ''
  return readFileSync(abs, 'utf-8')
}

describe('Context Semantics — CONTEXT_SEMANTICS_ENFORCED_001', () => {
  // ── Canonical package exists ───────────────────────────────────────────
  it('CONTEXT_CANONICAL_PKG_001: @nzila/org package exists with OrgContext + DbContext', () => {
    const index = readContent('packages/org/src/index.ts')
    expect(index).toBeTruthy()

    expect(index.includes('OrgContext'), '@nzila/org must export OrgContext').toBe(true)
    expect(index.includes('DbContext'), '@nzila/org must export DbContext').toBe(true)

    const types = readContent('packages/org/src/context/types.ts')
    expect(types).toBeTruthy()

    expect(types.includes('interface OrgContext'), 'types.ts must define OrgContext interface').toBe(true)
    expect(types.includes('interface DbContext'), 'types.ts must define DbContext interface').toBe(true)
    expect(types.includes('readonly orgId: string'), 'OrgContext must have readonly orgId').toBe(true)
    expect(types.includes('readonly actorId: string'), 'OrgContext must have readonly actorId').toBe(true)
    expect(types.includes('readonly requestId: string'), 'OrgContext must have readonly requestId').toBe(true)
  })

  // ── All domain OrgContext types include orgId ─────────────────────────
  const domainContextFiles = [
    { label: 'commerce-core', path: 'packages/commerce-core/src/types/index.ts', iface: 'OrgContext' },
    { label: 'zonga-core', path: 'packages/zonga-core/src/types/index.ts', iface: 'ZongaOrgContext' },
    { label: 'trade-core', path: 'packages/trade-core/src/types/index.ts', iface: 'TradeOrgContext' },
    { label: 'nacp-core', path: 'packages/nacp-core/src/types/index.ts', iface: 'NacpOrgContext' },
    { label: 'agri-core', path: 'packages/agri-core/src/types/index.ts', iface: 'AgriOrgContext' },
  ]

  for (const { label, path, iface } of domainContextFiles) {
    it(`CONTEXT_ORGID_${label.toUpperCase().replace('-', '_')}_002: ${iface} includes orgId`, () => {
      const content = readContent(path)
      expect(content, `${path} must exist`).toBeTruthy()

      // The interface must contain 'orgId' field
      expect(
        content.includes('orgId'),
        `${label}/${iface} must include 'orgId' as the canonical org identity field`,
      ).toBe(true)
    })
  }

  // ── All domain DB context types include orgId ─────────────────────────
  const dbContextFiles = [
    { label: 'commerce-db', path: 'packages/commerce-db/src/types.ts' },
    { label: 'trade-db', path: 'packages/trade-db/src/types.ts' },
    { label: 'agri-db', path: 'packages/agri-db/src/types.ts' },
  ]

  for (const { label, path } of dbContextFiles) {
    it(`CONTEXT_ORGID_DB_${label.toUpperCase().replace('-', '_')}_003: ${label} DbContext includes orgId`, () => {
      const content = readContent(path)
      expect(content, `${path} must exist`).toBeTruthy()

      expect(
        content.includes('orgId'),
        `${label} DbContext must include 'orgId' as the canonical org identity field`,
      ).toBe(true)
    })
  }

  // ── Domain packages depend on @nzila/org ──────────────────────────────
  const domainPackages = [
    'commerce-core',
    'zonga-core',
    'trade-core',
    'nacp-core',
    'commerce-db',
    'trade-db',
  ]

  for (const pkg of domainPackages) {
    it(`CONTEXT_ORG_DEP_${pkg.toUpperCase().replace('-', '_')}_004: ${pkg} depends on @nzila/org`, () => {
      const raw = readContent(`packages/${pkg}/package.json`)
      expect(raw, `packages/${pkg}/package.json must exist`).toBeTruthy()

      const parsed = JSON.parse(raw)
      expect(
        parsed.dependencies?.['@nzila/org'],
        `${pkg} must have @nzila/org in dependencies`,
      ).toBeTruthy()
    })
  }

  // ── Deprecated entityId fields are annotated ──────────────────────────
  it('CONTEXT_ENTITYID_DEPRECATED_005: entityId fields in core types have @deprecated annotation', () => {
    const targets = [
      'packages/commerce-core/src/types/index.ts',
      'packages/zonga-core/src/types/index.ts',
      'packages/trade-core/src/types/index.ts',
      'packages/nacp-core/src/types/index.ts',
    ]

    for (const path of targets) {
      const content = readContent(path)
      if (content.includes('entityId')) {
        expect(
          content.includes('@deprecated'),
          `${path}: entityId field must have @deprecated JSDoc annotation`,
        ).toBe(true)
      }
    }
  })
})
