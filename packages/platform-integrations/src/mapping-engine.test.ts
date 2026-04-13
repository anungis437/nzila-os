import { describe, it, expect } from 'vitest'
import { MappingEngine } from './mapping-engine'
import type { MappingContext } from './mapping-engine'
import type { MappingRuleDefinition, FieldMapping } from '@nzila/platform-integrations-types'

/** Helper to create a minimal MappingRuleDefinition from field mappings */
function rule(...fields: FieldMapping[]): MappingRuleDefinition {
  return {
    name: 'test-rule',
    sourceEntityType: 'external',
    targetEntityType: 'internal',
    fields,
  }
}

/** Helper to create a FieldMapping with sensible defaults */
function field(
  overrides: Partial<FieldMapping> & Pick<FieldMapping, 'sourceField' | 'targetField' | 'operation'>,
): FieldMapping {
  return { config: {}, required: false, ...overrides }
}

const ctx: MappingContext = { orgId: 'org-1', connectionId: 'conn-1' }

describe('MappingEngine', () => {
  const engine = new MappingEngine()

  describe('rename', () => {
    it('renames a field', async () => {
      const r = rule(field({ sourceField: 'first_name', targetField: 'firstName', operation: 'rename' }))
      const result = await engine.execute({ first_name: 'Alice' }, r, ctx)
      expect(result.data).toEqual({ firstName: 'Alice' })
      expect(result.errors).toHaveLength(0)
    })

    it('handles missing source field gracefully', async () => {
      const r = rule(field({ sourceField: 'missing_field', targetField: 'target', operation: 'rename' }))
      const result = await engine.execute({}, r, ctx)
      expect(result.data).toEqual({ target: undefined })
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('constant', () => {
    it('sets a constant value', async () => {
      const r = rule(field({ sourceField: '', targetField: 'source', operation: 'constant', config: { value: 'external' } }))
      const result = await engine.execute({}, r, ctx)
      expect(result.data).toEqual({ source: 'external' })
    })
  })

  describe('default', () => {
    it('applies default when source is missing', async () => {
      const r = rule(field({ sourceField: 'priority', targetField: 'priority', operation: 'default', config: { defaultValue: 'medium' } }))
      const result = await engine.execute({}, r, ctx)
      expect(result.data).toEqual({ priority: 'medium' })
    })

    it('preserves existing value over default', async () => {
      const r = rule(field({ sourceField: 'priority', targetField: 'priority', operation: 'default', config: { defaultValue: 'medium' } }))
      const result = await engine.execute({ priority: 'high' }, r, ctx)
      expect(result.data).toEqual({ priority: 'high' })
    })
  })

  describe('enum_translate', () => {
    it('translates enum values', async () => {
      const r = rule(field({
        sourceField: 'status', targetField: 'status', operation: 'enum_translate',
        config: { mappings: { OPEN: 'open', CLOSED: 'closed' }, unmappedPolicy: 'error' },
      }))
      const result = await engine.execute({ status: 'OPEN' }, r, ctx)
      expect(result.data).toEqual({ status: 'open' })
    })

    it('errors on unknown enum value without fallback', async () => {
      const r = rule(field({
        sourceField: 'status', targetField: 'status', operation: 'enum_translate',
        config: { mappings: { OPEN: 'open' }, unmappedPolicy: 'error' },
      }))
      const result = await engine.execute({ status: 'UNKNOWN' }, r, ctx)
      // Non-required field produces a warning, not an error
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('nested_extract', () => {
    it('extracts nested values using dot notation', async () => {
      const r = rule(
        field({ sourceField: 'address.city', targetField: 'city', operation: 'nested_extract', config: { path: 'address.city' } }),
        field({ sourceField: 'address.zip', targetField: 'zipCode', operation: 'nested_extract', config: { path: 'address.zip' } }),
      )
      const input = { address: { city: 'Montreal', zip: 'H2X 1Y4' } }
      const result = await engine.execute(input, r, ctx)
      expect(result.data).toEqual({ city: 'Montreal', zipCode: 'H2X 1Y4' })
    })
  })

  describe('coerce', () => {
    it('coerces string to number', async () => {
      const r = rule(field({ sourceField: 'amount', targetField: 'amount', operation: 'coerce', config: { type: 'number' } }))
      const result = await engine.execute({ amount: '42.5' }, r, ctx)
      expect(result.data).toEqual({ amount: 42.5 })
    })

    it('coerces to string', async () => {
      const r = rule(field({ sourceField: 'count', targetField: 'count', operation: 'coerce', config: { type: 'string' } }))
      const result = await engine.execute({ count: 100 }, r, ctx)
      expect(result.data).toEqual({ count: '100' })
    })

    it('coerces to boolean', async () => {
      const r = rule(field({ sourceField: 'active', targetField: 'active', operation: 'coerce', config: { type: 'boolean' } }))
      const result = await engine.execute({ active: 'true' }, r, ctx)
      expect(result.data).toEqual({ active: true })
    })
  })

  describe('omit', () => {
    it('omits specified fields', async () => {
      const r = rule(
        field({ sourceField: 'name', targetField: 'name', operation: 'rename' }),
        field({ sourceField: 'secret', targetField: 'secret', operation: 'omit' }),
      )
      const result = await engine.execute({ name: 'Alice', secret: 'password123' }, r, ctx)
      expect(result.data?.name).toBe('Alice')
      // omit sets value to undefined
      expect(result.data?.secret).toBeUndefined()
    })
  })

  describe('flatten', () => {
    it('flattens nested object into target field', async () => {
      const r = rule(field({ sourceField: 'meta', targetField: 'flatMeta', operation: 'flatten' }))
      const result = await engine.execute({ meta: { source: 'api', version: 2 } }, r, ctx)
      expect(result.data?.flatMeta).toEqual({ source: 'api', version: 2 })
    })
  })

  describe('preview (dry run)', () => {
    it('returns data without side effects', async () => {
      const r = rule(
        field({ sourceField: 'name', targetField: 'fullName', operation: 'rename' }),
        field({ sourceField: '', targetField: 'origin', operation: 'constant', config: { value: 'webhook' } }),
      )
      const result = await engine.preview({ name: 'Bob' }, r, ctx)
      expect(result.data).toEqual({ fullName: 'Bob', origin: 'webhook' })
      expect(result.transformationLog.length).toBeGreaterThan(0)
    })
  })

  describe('multi-step pipeline', () => {
    it('applies multiple mappings in sequence', async () => {
      const r = rule(
        field({ sourceField: 'ext_name', targetField: 'name', operation: 'rename' }),
        field({
          sourceField: 'ext_status', targetField: 'status', operation: 'enum_translate',
          config: { mappings: { A: 'active', I: 'inactive' } },
        }),
        field({ sourceField: '', targetField: 'source', operation: 'constant', config: { value: 'import' } }),
        field({ sourceField: 'priority', targetField: 'priority', operation: 'default', config: { defaultValue: 'normal' } }),
      )
      const result = await engine.execute({ ext_name: 'Case #1', ext_status: 'A' }, r, ctx)
      expect(result.data).toEqual({
        name: 'Case #1',
        status: 'active',
        source: 'import',
        priority: 'normal',
      })
    })
  })
})
