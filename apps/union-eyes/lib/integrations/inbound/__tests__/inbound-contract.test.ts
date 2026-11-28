import { describe, expect, it } from 'vitest'
import { validateInboundCase } from '../inbound-case-contract'
import { redactFailure } from '../redaction'
import { canonicalJson, sha256 } from '../durable-inbound-executor'
import { applyInboundMapping } from '../inbound-mapping'

const NOW = new Date('2026-11-28T12:00:00Z')
const valid = { externalCaseId: 'C-1', title: 'Title', description: 'Body', type: 'contract', priority: 'high', filedDate: '2026-01-10' }

describe('the inbound case contract', () => {
  it('accepts a complete case and normalizes its filed date', () => {
    expect(validateInboundCase(valid, NOW)).toEqual({ ok: true, value: { ...valid, filedDate: '2026-01-10T00:00:00.000Z', memberExternalId: null } })
  })

  it('never defaults a priority, a date or a type, and names each failing field', () => {
    const result = validateInboundCase({ ...valid, priority: 'whenever', filedDate: undefined, type: 'Contract', extra: 1 }, NOW)
    expect(result).toEqual({ ok: false, issues: [
      { field: 'extra', code: 'UNEXPECTED_FIELD' },
      { field: 'type', code: 'NOT_ALLOWED' },
      { field: 'priority', code: 'NOT_ALLOWED' },
      { field: 'filedDate', code: 'REQUIRED' },
    ] })
  })

  it('refuses a future, impossible or loosely formatted date', () => {
    for (const filedDate of ['2999-01-01', '2026-02-31x', 'yesterday', '10/01/2026']) {
      const result = validateInboundCase({ ...valid, filedDate }, NOW)
      expect(result.ok, filedDate).toBe(false)
    }
  })

  it('refuses a non-string or blank required field', () => {
    expect(validateInboundCase({ ...valid, title: 42 }, NOW)).toEqual({ ok: false, issues: [{ field: 'title', code: 'NOT_A_STRING' }] })
    expect(validateInboundCase({ ...valid, description: '   ' }, NOW)).toEqual({ ok: false, issues: [{ field: 'description', code: 'REQUIRED' }] })
  })
})

describe('failure redaction', () => {
  it('keeps a code, a SQLSTATE and a constraint name, never the driver message', () => {
    const driver = Object.assign(new Error('duplicate key value violates unique constraint "x" Key (email)=(pat@example.test) already exists'), {
      code: '23505', constraint: 'grievances_grievance_number_unique',
    })
    const wrapped = Object.assign(new Error('Failed query: insert ... params: pat@example.test'), { cause: driver })
    const redacted = redactFailure('DOMAIN_WRITE_FAILED', wrapped)
    expect(redacted).toEqual({ code: 'DOMAIN_WRITE_FAILED', sqlstate: '23505', constraint: 'grievances_grievance_number_unique' })
    expect(JSON.stringify(redacted)).not.toContain('example.test')
  })

  it('keeps a guard trigger reason and drops anything that is not an identifier', () => {
    expect(redactFailure('PERSISTENCE_FAILED', new Error('UE_INTEGRATION_SOURCE_NOT_ACTIVE'))).toEqual({ code: 'UE_INTEGRATION_SOURCE_NOT_ACTIVE' })
    expect(redactFailure('SCHEMA_REJECTED', undefined, ['title:REQUIRED', 'pat@example.test is not a field', 'priority'])).toEqual({
      code: 'SCHEMA_REJECTED', fields: ['title:REQUIRED', 'priority'],
    })
  })
})

describe('the payload digest', () => {
  it('does not depend on key order or undefined members', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[1,{"y":2,"z":1}]},"b":1}')
    expect(sha256(canonicalJson({ a: 1, b: 2 }))).toBe(sha256(canonicalJson({ b: 2, a: 1 })))
  })
})

describe('the inbound mapping', () => {
  const rule = (fields: unknown[]) => ({ name: 'r', sourceEntityType: 's', targetEntityType: 'case', fields }) as never
  it('renames, translates and defaults deterministically, leaving an absent optional field out', () => {
    const result = applyInboundMapping({ id: 'C-1', meta: { level: 'P1' } }, rule([
      { sourceField: 'id', targetField: 'externalCaseId', operation: 'rename', config: {}, required: true },
      { sourceField: 'meta.level', targetField: 'priority', operation: 'enum_translate', config: { map: { P1: 'urgent' } }, required: true },
      { sourceField: 'kind', targetField: 'type', operation: 'default', config: { value: 'other' }, required: true },
      { sourceField: 'member', targetField: 'memberExternalId', operation: 'rename', config: {}, required: false },
    ]))
    expect(result).toEqual({ success: true, data: { externalCaseId: 'C-1', priority: 'urgent', type: 'other' }, errors: [] })
  })
  it('fails on an unmapped value, a missing required field or an unsupported operation, naming no value', () => {
    const result = applyInboundMapping({ level: 'P9', secret: 'pat@example.test' }, rule([
      { sourceField: 'level', targetField: 'priority', operation: 'enum_translate', config: { map: { P1: 'urgent' } }, required: true },
      { sourceField: 'id', targetField: 'externalCaseId', operation: 'rename', config: {}, required: true },
      { sourceField: 'secret', targetField: 'x', operation: 'computed', config: {}, required: false },
    ]))
    expect(result).toEqual({ success: false, data: null, errors: [
      { field: 'priority', code: 'ENUM_UNMAPPED' }, { field: 'externalCaseId', code: 'REQUIRED_MISSING' }, { field: 'x', code: 'OPERATION_UNSUPPORTED' },
    ] })
  })
})
