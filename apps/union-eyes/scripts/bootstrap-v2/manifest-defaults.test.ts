import { describe, expect, it } from 'vitest'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { storageAuthorityManifest } from '../../db/rls-storage-authority'
import type { SourceTable } from './source'
import {
  callerDefaultDeclarationSelected,
  compareDeclaredDefaults,
  normalizeDefaultExpression,
  renderDeclaredDefault,
} from './manifest-defaults'

describe('independent server-default qualification', () => {
  it('compares typed decimal literals without float conversion or precision loss', () => {
    expect(normalizeDefaultExpression("'0.00'", 'numeric')).toBe(
      normalizeDefaultExpression('0.00', 'numeric'),
    )
    expect(normalizeDefaultExpression("'40.00'", 'numeric')).toBe(
      normalizeDefaultExpression('(40.00)::numeric', 'numeric'),
    )
    expect(normalizeDefaultExpression("'1.25e2'", 'numeric')).toBe(
      normalizeDefaultExpression('125', 'numeric'),
    )
    expect(normalizeDefaultExpression("'9007199254740993.00'", 'numeric')).not.toBe(
      normalizeDefaultExpression('9007199254740992', 'numeric'),
    )
    expect(normalizeDefaultExpression("'1.00'", 'numeric')).not.toBe(
      normalizeDefaultExpression('1.01', 'numeric'),
    )
  })
  it('rejects missing UUID, audit and scalar server defaults even when the catalog matches a reference', () => {
    expect(
      compareDeclaredDefaults(
        [
          { table: 'example', column: 'id', generator: 'UUID4' },
          { table: 'example', column: 'created_at', generator: 'AUDIT_NOW' },
          {
            table: 'example',
            column: 'enabled',
            generator: 'DECLARED_DEFAULT',
            expression: 'true',
          },
        ],
        [
          { table: 'example', column: 'id', expression: null },
          { table: 'example', column: 'created_at', expression: null },
          { table: 'example', column: 'enabled', expression: 'NULL::boolean' },
        ],
      ),
    ).toEqual([
      'DECLARED_SERVER_DEFAULT_MISSING:example.id',
      'DECLARED_SERVER_DEFAULT_MISSING:example.created_at',
      'DECLARED_SERVER_DEFAULT_MISSING:example.enabled',
    ])
  })

  it('rejects wrong generators and scalar values', () => {
    expect(
      compareDeclaredDefaults(
        [
          { table: 'example', column: 'id', generator: 'UUID4' },
          {
            table: 'example',
            column: 'enabled',
            generator: 'DECLARED_DEFAULT',
            expression: 'true',
          },
        ],
        [
          {
            table: 'example',
            column: 'id',
            expression: "'00000000-0000-0000-0000-000000000000'::uuid",
          },
          { table: 'example', column: 'enabled', expression: 'false' },
        ],
      ),
    ).toEqual([
      'CURRENT_MODEL_SERVER_GENERATOR_MISMATCH:example.id',
      'DECLARED_SERVER_DEFAULT_EXPRESSION_MISMATCH:example.enabled',
    ])
  })

  it('accepts native timestamp aliases and typed string literals without executing expressions', () => {
    expect(
      compareDeclaredDefaults(
        [
          { table: 'example', column: 'created_at', generator: 'AUDIT_NOW' },
          { table: 'example', column: 'name', generator: 'DECLARED_DEFAULT', expression: "'A::B'" },
        ],
        [
          { table: 'example', column: 'created_at', expression: 'now()' },
          { table: 'example', column: 'name', expression: "'A::B'::character varying" },
        ],
      ),
    ).toEqual([])
    expect(normalizeDefaultExpression("'A B'")).not.toBe(normalizeDefaultExpression("'A  B'"))
  })

  it('fails unrenderable declared expressions instead of substituting presence-only success', () => {
    expect(
      compareDeclaredDefaults(
        [{ table: 'example', column: 'value', generator: 'DECLARED_DEFAULT' }],
        [{ table: 'example', column: 'value', expression: '1' }],
      ),
    ).toEqual(['DECLARED_SERVER_DEFAULT_EXPRESSION_MISMATCH:example.value'])
  })

  it('renders actual Drizzle JSON and array driver literals without executing defaults', () => {
    const declaration = pgTable('literal_defaults', {
      object: jsonb().default({ camera: true, gps: true }),
      list: jsonb().default([]),
      array: text().array().default([]),
    })
    expect(renderDeclaredDefault(declaration.object)).toBe('\'{"camera":true,"gps":true}\'::jsonb')
    expect(renderDeclaredDefault(declaration.list)).toBe("'[]'::jsonb")
    expect(renderDeclaredDefault(declaration.array)).toBe("'{}'::text[]")
  })

  it('compares jsonb values rather than PostgreSQL key order or output whitespace', () => {
    expect(
      compareDeclaredDefaults(
        [
          {
            table: 'example',
            column: 'metadata',
            generator: 'DECLARED_DEFAULT',
            expression: '\'{"camera":true,"gps":true}\'::jsonb',
            literalType: 'jsonb',
          },
        ],
        [
          {
            table: 'example',
            column: 'metadata',
            expression: '\'{"gps": true, "camera": true}\'::jsonb',
          },
        ],
      ),
    ).toEqual([])
    expect(normalizeDefaultExpression('\'{"value":"two words"}\'::jsonb', 'jsonb')).not.toBe(
      normalizeDefaultExpression('\'{"value":"two  words"}\'::jsonb', 'jsonb'),
    )
    expect(normalizeDefaultExpression("'[1,2]'::jsonb", 'jsonb')).not.toBe(
      normalizeDefaultExpression("'[2,1]'::jsonb", 'jsonb'),
    )
    expect(normalizeDefaultExpression('\'{"enabled":true}\'::jsonb', 'jsonb')).not.toBe(
      normalizeDefaultExpression('\'{"enabled":false}\'::jsonb', 'jsonb'),
    )
  })

  it('keeps excluded caller overlays and duplicate auth declarations out of canonical expectations', () => {
    const base: SourceTable = {
      name: 'claims',
      columns: [],
      foreignKeys: [],
      source: 'current-model',
      sourceDigest: 'source',
      authority: storageAuthorityManifest.find((entry) => entry.table === 'claims') ?? null,
    }
    expect(callerDefaultDeclarationSelected(base, 'current-caller')).toBe(true)
    for (const classification of ['LATENT_UNREACHABLE', 'CONTAINED_NO_AUTHORITY'] as const) {
      const authority = storageAuthorityManifest.find(
        (entry) => entry.classification === classification,
      )
      if (!authority) throw new Error(`Test requires current ${classification} authority`)
      expect(callerDefaultDeclarationSelected({ ...base, authority }, 'current-caller')).toBe(false)
    }
    expect(callerDefaultDeclarationSelected({ ...base, authority: null }, 'current-caller')).toBe(
      false,
    )
    expect(
      callerDefaultDeclarationSelected(
        { ...base, name: 'cms_pages', authority: null },
        'current-caller',
      ),
    ).toBe(true)
    expect(callerDefaultDeclarationSelected(base, 'duplicate-auth', 'user_management')).toBe(false)
    expect(callerDefaultDeclarationSelected(base, 'current-model', 'user_management')).toBe(true)
  })
})
