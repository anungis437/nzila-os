import { describe, expect, it } from 'vitest'
import { DATA_SOURCES } from '@/lib/report-executor'
import { MAX_STORED_CONFIG_BYTES, validateStoredReportConfig } from '../report-config-validation'

const source = DATA_SOURCES[0]
const field = source.fields[0].id
const valid = () => ({ dataSourceId: source.id, fields: [{ fieldId: field, fieldName: field }] })

describe('validateStoredReportConfig', () => {
  it('accepts a definition the executor would run', () => {
    expect(validateStoredReportConfig({ ...valid(), filters: [{ fieldId: field, operator: 'eq', value: 'x' }], sortBy: [{ fieldId: field, direction: 'asc' }] })).toBeNull()
  })

  it('refuses something that is not an object, or has no source and field', () => {
    expect(validateStoredReportConfig(null)).toMatch(/object/)
    expect(validateStoredReportConfig([])).toMatch(/object/)
    expect(validateStoredReportConfig({ fields: [] })).toMatch(/dataSourceId/)
  })

  it('refuses an unknown source, an unknown field and a refused operator', () => {
    expect(validateStoredReportConfig({ ...valid(), dataSourceId: 'no-such-source' })).toMatch(/Invalid data source/)
    expect(validateStoredReportConfig({ dataSourceId: source.id, fields: [{ fieldId: 'no_such_field', fieldName: 'x' }] })).toMatch(/Invalid field/)
    expect(validateStoredReportConfig({ ...valid(), filters: [{ fieldId: field, operator: 'drop_table', value: 1 }] })).toMatch(/Invalid operator/)
  })

  it('refuses a join to a table outside the registry', () => {
    expect(validateStoredReportConfig({ ...valid(), joins: [{ table: 'users', type: 'inner', on: { leftField: 'a', rightField: 'b' } }] })).toMatch(/registry/)
  })

  it('refuses a definition that is too large or nested too deeply', () => {
    expect(validateStoredReportConfig({ ...valid(), note: 'x'.repeat(MAX_STORED_CONFIG_BYTES) })).toMatch(/too large/)
    let deep: Record<string, unknown> = {}
    for (let i = 0; i < 10; i++) deep = { n: deep }
    expect(validateStoredReportConfig({ ...valid(), deep })).toMatch(/nested/)
  })

  it('refuses unbounded lists', () => {
    expect(validateStoredReportConfig({ ...valid(), filters: Array.from({ length: 101 }, () => ({ fieldId: field, operator: 'eq', value: 1 })) })).toMatch(/bounded/)
  })
})
