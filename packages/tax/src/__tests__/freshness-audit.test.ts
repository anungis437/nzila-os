import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { DATA_VERSIONS } from '../data-versions'
import { auditTaxReferenceData, type TaxReleaseDisposition } from '../freshness-audit'

const AS_OF = new Date('2026-11-26T00:00:00.000Z')
const PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url))

function disposition(overrides: Partial<TaxReleaseDisposition> = {}): TaxReleaseDisposition {
  return {
    decisionId: 'TAX-FRESHNESS-2026-11-26',
    approver: 'release-governance',
    acceptedCurrentness: 'STALE',
    expiresOn: '2026-12-26',
    scope: ['apps/cfo'],
    ...overrides,
  }
}

describe('live tax reference freshness', () => {
  it('reports all 10 recorded modules stale without changing their verification dates', () => {
    const before = DATA_VERSIONS.map((module) => module.lastVerified)
    const audit = auditTaxReferenceData({ asOf: AS_OF })
    expect(audit.status).toBe('TAX_REFERENCE_DATA_CURRENTNESS')
    expect(audit.currentness).toBe('STALE')
    expect(audit.releaseEligibility).toBe('BLOCKED')
    expect(audit.modules).toHaveLength(10)
    expect(audit.modules.every((module) => module.classification === 'STALE')).toBe(true)
    expect(audit.modules.every((module) => module.lastVerified === '2026-08-26')).toBe(true)
    expect(audit.modules.every((module) => module.thresholdDays === 90)).toBe(true)
    expect(audit.modules.every((module) => module.source && module.requiredAction.includes('Re-verify'))).toBe(true)
    expect(DATA_VERSIONS.map((module) => module.lastVerified)).toEqual(before)
  })

  it('does not treat a passing algorithm result as current reference data', () => {
    const currentAlgorithm = auditTaxReferenceData({ asOf: new Date('2026-08-26T00:00:00.000Z') })
    const liveRegistry = auditTaxReferenceData({ asOf: AS_OF })
    expect(currentAlgorithm.currentness).toBe('CURRENT')
    expect(liveRegistry.currentness).toBe('STALE')
  })

  it('updates only the module that was actually re-verified', () => {
    const partial = DATA_VERSIONS.map((module) =>
      module.module === 'rates' ? { ...module, lastVerified: '2026-11-26' } : module,
    )
    const audit = auditTaxReferenceData({ asOf: AS_OF, modules: partial })
    expect(audit.modules.find((module) => module.module === 'rates')?.classification).toBe('FRESH')
    expect(audit.modules.filter((module) => module.classification === 'STALE')).toHaveLength(9)
    expect(audit.currentness).toBe('STALE')
    expect(DATA_VERSIONS.find((module) => module.module === 'rates')?.lastVerified).toBe('2026-08-26')
  })

  it('does not count a missing source or a future timestamp as verification', () => {
    const audit = auditTaxReferenceData({
      asOf: AS_OF,
      modules: [
        { module: 'rates', taxYear: 2026, lastVerified: '2026-11-26', source: '   ' },
        { module: 'gst-hst', taxYear: 2026, lastVerified: '2026-12-01', source: 'CRA GI-209' },
      ],
    })
    expect(audit.modules.map((module) => module.classification)).toEqual(['MISSING_SOURCE', 'FUTURE_CLAIM'])
    expect(audit.currentness).toBe('UNVERIFIED')
    expect(audit.releaseEligibility).toBe('BLOCKED')
  })

  it('blocks a stale release until the disposition names the actual currentness', () => {
    expect(auditTaxReferenceData({ asOf: AS_OF }).releaseEligibility).toBe('BLOCKED')
    expect(() => auditTaxReferenceData({
      asOf: AS_OF,
      disposition: disposition({ acceptedCurrentness: 'UNVERIFIED' }),
    })).toThrow('DISPOSITION_CANNOT_CHANGE_CURRENTNESS')
    const accepted = auditTaxReferenceData({ asOf: AS_OF, disposition: disposition() })
    expect(accepted.currentness).toBe('STALE')
    expect(accepted.releaseEligibility).toBe('RISK_DISPOSITIONED')
    expect(accepted.disposition?.approver).toBe('release-governance')
  })

  it('treats an empty registry as unverified and rejects a blank decision', () => {
    const audit = auditTaxReferenceData({ asOf: AS_OF, modules: [] })
    expect(audit.currentness).toBe('UNVERIFIED')
    expect(audit.releaseEligibility).toBe('BLOCKED')
    expect(() => auditTaxReferenceData({
      asOf: AS_OF,
      modules: [],
      disposition: disposition({ acceptedCurrentness: 'UNVERIFIED', decisionId: ' ' }),
    })).toThrow('DISPOSITION_DECISION_REQUIRED')
    expect(() => auditTaxReferenceData({
      asOf: AS_OF,
      modules: [],
      disposition: disposition({ acceptedCurrentness: 'UNVERIFIED', scope: [] }),
    })).toThrow('DISPOSITION_SCOPE_REQUIRED')
  })

  it('rejects an expired disposition and a missing approver', () => {
    expect(() => auditTaxReferenceData({
      asOf: AS_OF,
      disposition: disposition({ expiresOn: '2026-11-25' }),
    })).toThrow('DISPOSITION_EXPIRED_OR_INVALID')
    expect(() => auditTaxReferenceData({
      asOf: AS_OF,
      disposition: disposition({ approver: ' ' }),
    })).toThrow('DISPOSITION_APPROVER_REQUIRED')
  })
})

describe('freshness audit command', () => {
  it('exits blocked for the recorded registry and current for the verification instant', () => {
    const blocked = runAudit(['--as-of', '2026-11-26T00:00:00.000Z'])
    expect(blocked.status).toBe(2)
    expect(JSON.parse(blocked.stdout).currentness).toBe('STALE')
    expect(blocked.stderr).toContain('TAX_REFERENCE_DATA_CURRENTNESS=STALE')

    const current = runAudit(['--as-of', '2026-08-26T00:00:00.000Z'])
    expect(current.status).toBe(0)
    expect(JSON.parse(current.stdout).currentness).toBe('CURRENT')
  })

  it('writes the audit without inventing a later verification date', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tax-freshness-'))
    const output = join(directory, 'audit.json')
    const result = runAudit(['--as-of', '2026-11-26T00:00:00.000Z', '--out', output])
    expect(result.status).toBe(2)
    const audit = JSON.parse(readFileSync(output, 'utf8'))
    expect(audit.modules.every((module: { lastVerified: string }) => module.lastVerified === '2026-08-26')).toBe(true)
    expect(audit.evaluatedAt).toBe('2026-11-26T00:00:00.000Z')
  })

  it('accepts the separator pnpm inserts before script arguments', () => {
    const result = spawnSync(
      'pnpm',
      ['freshness:audit', '--', '--as-of', '2026-11-26T00:00:00.000Z'],
      { cwd: PACKAGE_ROOT, encoding: 'utf8' },
    )
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('TAX_REFERENCE_DATA_CURRENTNESS=STALE')
  })

  it('rejects a disposition that claims the data is current', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tax-freshness-'))
    const dispositionPath = join(directory, 'disposition.json')
    writeFileSync(dispositionPath, JSON.stringify({ ...disposition(), acceptedCurrentness: 'CURRENT' }))
    const result = runAudit(['--as-of', '2026-11-26T00:00:00.000Z', '--risk-disposition', dispositionPath])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('DISPOSITION_CANNOT_CHANGE_CURRENTNESS')
  })
})

function runAudit(args: string[]) {
  return spawnSync(
    'pnpm',
    ['exec', 'tsx', 'src/freshness-audit-cli.ts', ...args],
    { cwd: PACKAGE_ROOT, encoding: 'utf8' },
  )
}
