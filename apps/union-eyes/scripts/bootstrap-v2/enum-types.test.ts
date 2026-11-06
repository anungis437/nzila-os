import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  currentModelEnumTypes,
  folder,
  type CurrentColumn,
  type CurrentModel,
  type V2Plan,
} from './source'

function column(name: string, type: string, extra: Partial<CurrentColumn> = {}): CurrentColumn {
  return {
    name,
    type,
    notNull: true,
    primaryKey: false,
    unique: false,
    index: false,
    hasClientDefault: false,
    clientDefault: null,
    choices: [],
    foreignKey: null,
    ...extra,
  }
}
function model(table: string, columns: CurrentColumn[]): CurrentModel {
  return {
    table,
    app: 'test',
    model: table,
    source: 'test',
    sourceDigest: '0'.repeat(64),
    columns,
    uniqueTogether: [],
    constraints: [],
  }
}
const categories = column('categories', 'movement_trend_category[]', {
  enumType: 'movement_trend_category',
  enumValues: ['grievance-type', "o'brien"],
})

describe('current Django enum types', () => {
  it('creates an enum-array type under the name the field casts to, with its choices as labels', () => {
    expect([...currentModelEnumTypes([model('data_aggregation_consent', [categories])])]).toEqual([
      [
        'public.movement_trend_category',
        `CREATE TYPE "public"."movement_trend_category" AS ENUM ('grievance-type', 'o''brien');`,
      ],
    ])
  })
  it('accepts a Drizzle enum of the same name only with the same labels', () => {
    const models = [model('data_aggregation_consent', [categories])]
    expect(
      currentModelEnumTypes(models, { movement_trend_category: ['grievance-type', "o'brien"] })
        .size,
    ).toBe(1)
    expect(() =>
      currentModelEnumTypes(models, { movement_trend_category: ['grievance-type'] }),
    ).toThrow('UE_V2_CURRENT_ENUM_SOURCE_CONFLICT:movement_trend_category')
  })
  it('refuses two fields that declare one type with different labels', () => {
    const other = column('categories', 'movement_trend_category[]', {
      enumType: 'movement_trend_category',
      enumValues: ['sector-trend'],
    })
    expect(() => currentModelEnumTypes([model('a', [categories]), model('b', [other])])).toThrow(
      'UE_V2_CURRENT_ENUM_CONFLICT:movement_trend_category',
    )
  })
  it('refuses a column whose SQL type is not the declared enum or its array', () => {
    const drifted = column('categories', 'text[]', {
      enumType: 'movement_trend_category',
      enumValues: ['grievance-type'],
    })
    expect(() => currentModelEnumTypes([model('a', [drifted])])).toThrow(
      'UE_V2_CURRENT_ENUM_COLUMN_TYPE_MISMATCH:a.categories',
    )
  })

  it('creates every non-builtin column type of the committed plan before the table that uses it', () => {
    const plan: V2Plan = JSON.parse(
      readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'),
    )
    const builtin =
      /^(uuid|text|jsonb|integer|smallint|bigint|boolean|numeric|real|date|time|inet|varchar|timestamp|timestamp with time zone)$/
    const created = new Map<string, number>()
    plan.statements.forEach((statement, index) => {
      const name = statement.sql.match(/^CREATE TYPE "public"\."([^"]+)"/)?.[1]
      if (name) created.set(name, index)
    })
    const enumArrays: string[] = []
    for (const table of plan.tables)
      for (const { name, type } of table.columns) {
        const base = type.replace(/\[\]$/, '').replace(/\(.*\)$/, '')
        if (builtin.test(base)) continue
        expect(created.has(base), `${table.name}.${name}: ${type}`).toBe(true)
        if (type.endsWith('[]')) enumArrays.push(`${table.name}.${name}:${type}`)
        const first = plan.statements.findIndex((statement) =>
          new RegExp(`CREATE TABLE "?(public"?\\.)?"?${table.name}"? `).test(statement.sql),
        )
        if (first >= 0) expect(created.get(base)!).toBeLessThan(first)
      }
    // Pinned so a new enum-backed array is a reviewed change to this test.
    expect(enumArrays.sort()).toEqual([
      'data_aggregation_consent.categories:movement_trend_category[]',
      'notification_templates.channels:notification_channel[]',
    ])
  })
})
