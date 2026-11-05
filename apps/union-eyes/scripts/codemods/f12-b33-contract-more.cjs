const fs = require('fs')
const f = 'lib/api/__tests__/f12-b33-responses.contract.test.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').trimEnd()
if (!s.endsWith('})')) throw new Error('end')
s = s.slice(0, -2) + `
  // DEF-0B8-HS-ARCHIVED-ROWS-STILL-READABLE-AND-COUNTED
  it.each([
    ['hazards/route.ts', 'hazardReports'],
    ['hazards/[id]/route.ts', 'hazardReports'],
    ['incidents/route.ts', 'workplaceIncidents'],
    ['incidents/[id]/route.ts', 'workplaceIncidents'],
  ])('health-safety/%s neither lists nor returns an archived record', (route, table) => {
    expect(read(\`app/api/health-safety/\${route}\`)).toContain(\`readCondition: ne(\${table}.status, 'archived')\`)
  })

  it.each(['hazards/stats', 'incidents/stats', 'incidents/trends', 'dashboard'])('health-safety/%s does not count an archived record', (route) => {
    expect(read(\`app/api/health-safety/\${route}/route.ts\`)).toContain("'archived'")
  })

  // DEF-0B12-WBK-CHECKOUT-READS-THE-USER-OWNED-WORKBOOKS-TABLE-OUTSIDE-ANY-DATABASE-CONTEXT
  it('the workbook checkout reads through the system context, not the bare connection', () => {
    const source = read('app/api/workbook/checkout/route.ts')
    expect(source).toContain('withSystemContext(')
    expect(source).not.toContain("from '@/db';")
  })

  // DEF-0B11-PRP-PRECEDENT-SEARCH-USES-UNESCAPED-WILDCARD-LIKE
  it('the precedent search accepts only the filters it reads', () => {
    const source = read('app/api/precedents/search/route.ts')
    expect(source).toContain('.strict()')
    expect(source).toContain('INVALID_PRECEDENT_FILTER')
    expect(source).not.toContain('z.record(z.string(), z.unknown())')
  })
})
`
fs.writeFileSync(f, s)
console.log('ok')
