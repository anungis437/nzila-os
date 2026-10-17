import { describe, expect, it, vi } from 'vitest'
import type pg from 'pg'
import {
  bindCreation,
  normalizeDeclaredType,
  renderManifestMarkdown,
  verifyDeclaredSource,
} from './manifest'
import type { ExecutionTrace } from './manifest-trace'
import type { V2Plan } from './source'

const address = {
  canonicalId: 'column:public.example.id',
  address: 'pg_class:42:1',
  nativeType: 'table column',
  nativeIdentity: 'public.example.id',
}
const trace: ExecutionTrace = {
  baseline: [],
  executions: [],
  events: [{ address: address.address, order: 23, command: 'CREATE TABLE' }],
}

describe('native manifest measured authority', () => {
  it.each([
    ['timestamp', 'timestamp without time zone'],
    ['timestamp(6)[]', 'timestamp(6) without time zone[]'],
    ['timestamptz', 'timestamp with time zone'],
    ['"public"."status_enum"', 'status_enum'],
    ['varchar(20)', 'character varying(20)'],
  ])('normalizes PostgreSQL type aliases %s without changing semantics', (declared, native) => {
    expect(normalizeDeclaredType(declared)).toBe(normalizeDeclaredType(native))
  })
  it('binds first observed execution, never sorted inventory position or later grant order', () => {
    expect(
      bindCreation(
        address,
        {
          ...trace,
          events: [{ address: address.address, order: 90, command: 'GRANT' }, ...trace.events],
        },
        [],
      ),
    ).toEqual({ order: 23, basis: 'DDL_EVENT', address: address.address })
  })
  it('reports missing provenance rather than assigning a fake ordinal', () => {
    expect(bindCreation(address, { ...trace, events: [] }, [])).toEqual({
      order: null,
      basis: 'UNRESOLVED',
      address: address.address,
    })
  })
  it('distinguishes pre-existing prerequisites from observed mutations', () => {
    expect(bindCreation(address, { ...trace, baseline: [address] }, []).basis).toBe(
      'PREEXISTING_PREREQUISITE',
    )
  })
  it('binds implicit array/row types only through native automatic dependencies', () => {
    const edges = [
      {
        address: 'pg_type:99:0',
        referencedAddress: address.address,
        nativeType: address.nativeType,
        nativeIdentity: address.nativeIdentity,
        dependencyType: 'i',
        scope: 'DATABASE' as const,
      },
    ]
    expect(bindCreation({ ...address, address: 'pg_type:99:0' }, trace, edges).order).toBe(23)
    expect(
      bindCreation(
        { ...address, address: 'pg_type:99:0' },
        trace,
        edges.map((edge) => ({ ...edge, dependencyType: 'n' })),
      ).basis,
    ).toBe('UNRESOLVED')
  })
  it('terminates on dependency cycles without inventing creation', () => {
    expect(
      bindCreation(address, { ...trace, events: [] }, [
        {
          address: address.address,
          referencedAddress: address.address,
          nativeType: address.nativeType,
          nativeIdentity: address.nativeIdentity,
          dependencyType: 'i',
          scope: 'DATABASE',
        },
      ]).basis,
    ).toBe('UNRESOLVED')
  })
  it.each([
    ['column_default:public.example.id', 'pg_attrdef:99:0'],
    ['index:public.example_late_unique', 'pg_class:99:0'],
    ['constraint:example.example_late_unique', 'pg_constraint:99:0'],
  ])('does not backdate unobserved %s to parent CREATE', (canonicalId, nativeAddress) => {
    expect(
      bindCreation({ ...address, canonicalId, address: nativeAddress }, trace, [
        {
          address: nativeAddress,
          referencedAddress: address.address,
          nativeType: address.nativeType,
          nativeIdentity: address.nativeIdentity,
          dependencyType: 'a',
          scope: 'DATABASE',
        },
      ]),
    ).toEqual({ order: null, basis: 'UNRESOLVED', address: nativeAddress })
  })
  it('renders deterministic honest inventory even with unresolved bindings', () => {
    const input = { objects: [], catalogDigest: 'abc', blockers: ['SOURCE|MISSING'] }
    expect(renderManifestMarkdown(input)).toBe(renderManifestMarkdown(input))
    expect(renderManifestMarkdown(input)).toContain('SOURCE\\|MISSING')
    expect(renderManifestMarkdown(input)).toContain(
      'not SaaS, engineering, or production-security acceptance',
    )
  })
  it('independently rejects source-column and key defects despite reference equality', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            table: 'example',
            column: 'id',
            type: 'text',
            notnull: false,
            primary: false,
            unique: false,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
    const plan = {
      sourceCommitments: {},
      tables: [
        {
          name: 'example',
          columns: [{ name: 'id', type: 'uuid', notNull: true }],
          foreignKeys: [{ column: 'id', table: 'parent', referencedColumn: 'id' }],
        },
      ],
      currentModels: {
        models: [{ table: 'example', columns: [{ name: 'id', primaryKey: true, unique: true }] }],
      },
    } as unknown as V2Plan
    const result = await verifyDeclaredSource({ query } as unknown as pg.Client, plan)
    expect(result.status).toBe('FAIL')
    expect(result.mismatches).toEqual([
      'DECLARED_COLUMN_MISMATCH:example.id',
      'DECLARED_FOREIGN_KEY_MISMATCH:example.id',
      'CURRENT_MODEL_KEY_MISMATCH:example.id',
    ])
  })
})
