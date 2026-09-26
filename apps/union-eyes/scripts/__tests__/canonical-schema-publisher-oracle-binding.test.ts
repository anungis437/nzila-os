import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../../../..')
const MANIFEST = join(ROOT, 'tooling/db/canonical-schema/manifest.json')
const BINDING = join(ROOT, 'tooling/db/canonical-schema/oracle-binding.json')
const ORACLE = join(ROOT, 'reports/union-eyes-runtime-schema-authority-oracle.json')
const DISP = join(ROOT, 'reports/union-eyes/runtime-schema-lineage/disposition-cards-29.json')

describe('canonical-schema publisher oracle binding', () => {
  it('binding asserts no second schema authority and green oracle flags', () => {
    expect(existsSync(BINDING)).toBe(true)
    const b = JSON.parse(readFileSync(BINDING, 'utf-8'))
    expect(b.PUBLISHER_SECOND_SCHEMA_AUTHORITY).toBe('NO')
    expect(b.PUBLISHER_CANONICAL_ORACLE).toBe('PASS')
    expect(b.MISSING_REQUIRED_TABLES).toBe(0)
    expect(b.MISSING_REQUIRED_COLUMNS).toBe(0)
  })

  it('published table set equals disposition-adjusted oracle REQUIRED set', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'))
    const oracle = JSON.parse(readFileSync(ORACLE, 'utf-8'))
    const disp = JSON.parse(readFileSync(DISP, 'utf-8'))
    const excluded = new Set((disp.remainingCards || []).map((c: { TABLE: string }) => c.TABLE))
    const required = new Set(
      (oracle.records || [])
        .filter((r: { table: string; canonicalRequirement?: string }) =>
          r.canonicalRequirement === 'REQUIRED' && !excluded.has(r.table),
        )
        .map((r: { table: string }) => r.table),
    )
    const published = new Set(Object.keys(manifest.tables || {}))
    expect(manifest.publisherSecondSchemaAuthority).toBe(false)
    expect(manifest.authoritySource).toBe('reports/union-eyes-runtime-schema-authority-oracle.json')
    expect([...published].sort()).toEqual([...required].sort())
  })
})
