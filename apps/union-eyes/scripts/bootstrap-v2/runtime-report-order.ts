/** Source-complete diagnostic order; this changes no table or proof denominator. */
import assert from 'node:assert/strict'
export function orderRuntimeReports<T extends { table: string }>(
  rules: readonly T[],
  guardedTables: readonly string[],
  columnTables: readonly string[],
): T[] {
  const byTable = new Map(rules.map((rule) => [rule.table, rule]))
  assert.equal(byTable.size, rules.length, 'DUPLICATE_RUNTIME_REPORT_TABLE_FORBIDDEN')
  const priority = [...guardedTables, ...columnTables]
  assert.equal(
    new Set(priority).size,
    priority.length,
    'DUPLICATE_RUNTIME_PRIORITY_TABLE_FORBIDDEN',
  )
  const first = priority.flatMap((table) => {
    const rule = byTable.get(table)
    return rule ? [rule] : []
  })
  const selected = new Set(first.map((rule) => rule.table))
  const ordered = [...first, ...rules.filter((rule) => !selected.has(rule.table))]
  assert.equal(ordered.length, rules.length, 'RUNTIME_REPORT_DENOMINATOR_CHANGED')
  assert.deepEqual(
    ordered.map((rule) => rule.table).sort(),
    [...byTable.keys()].sort(),
    'RUNTIME_REPORT_SET_CHANGED',
  )
  return ordered
}
