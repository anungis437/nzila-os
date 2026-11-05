const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
fs.writeFileSync('lib/employer-execution/csv-cell.ts', `// A spreadsheet reads a cell that starts with = + - @ tab or CR as a formula; the external id comes from an uploaded file.
export function csvCell(value: string): string {
  const text = /^[=+\\-@\\t\\r]/.test(value) ? \`'\${value}\` : value
  return /[",\\r\\n]/.test(text) ? \`"\${text.replace(/"/g, '""')}"\` : text
}
`)
fs.writeFileSync('lib/employer-execution/__tests__/csv-cell.test.ts', `import { describe, expect, it } from 'vitest'
import { csvCell } from '../csv-cell'

// DEF-0B6-EMP-REMITTANCE-PACKAGE-SHAPE
describe('csvCell', () => {
  it('leaves an ordinary identifier alone', () => {
    expect(csvCell('E-1001')).toBe('E-1001')
  })

  it.each(['=cmd|calc', '+1+1', '-2+3', '@SUM(A1)', '\\tTAB', '\\rCR'])('neutralises a leading formula character in %j', (value) => {
    expect(csvCell(value).replace(/^"/, '').startsWith("'")).toBe(true)
  })

  it('quotes a cell holding a comma, a quote or a newline and doubles the quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('a\\nb')).toBe('"a\\nb"')
  })
})
`)
edit('app/api/employer-execution/remittance-runs/route.ts', [
  [`import { enforceRunDuty } from "../_guard";`, `import { enforceRunDuty } from "../_guard";\nimport { csvCell } from "@/lib/employer-execution/csv-cell";`],
  [`        row.employeeExternalId,
        row.gross.toFixed(2),`, `        csvCell(row.employeeExternalId),
        row.gross.toFixed(2),`],
  [`          { groupKey: "dues", contributionType: "dues", amount: totals.dues },
          { groupKey: "benefits", contributionType: "benefits", amount: totals.benefits },
          { groupKey: "pension", contributionType: "pension", amount: totals.pension },`,
   `          { groupKey: "dues", contributionType: "dues", amount: totals.dues, members: contributing(items, "duesAmount") },
          { groupKey: "benefits", contributionType: "benefits", amount: totals.benefits, members: contributing(items, "benefitAmount") },
          { groupKey: "pension", contributionType: "pension", amount: totals.pension, members: contributing(items, "pensionAmount") },`],
  [`          memberCount: items.length.toString(),`, `          memberCount: item.members.toString(),`],
  [`const createSchema = z.object({`, `// A group reports the members who actually contribute to it, not every item of the payroll run.
function contributing(items: Array<Record<string, unknown>>, column: string): number {
  return items.filter((item) => Number(item[column]) > 0).length;
}

const createSchema = z.object({`],
])
console.log('ok')
