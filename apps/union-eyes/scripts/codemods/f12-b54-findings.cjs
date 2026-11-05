const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
edit('app/api/health-safety/inspections/findings/route.ts', [
  ["complianceRate: row.score_percentage != null ? Number(row.score_percentage) : 0,", "// An inspection with no recorded score has no compliance rate; it is not 0%.\n        complianceRate: row.score_percentage != null ? Number(row.score_percentage) : null,"],
])
edit('components/health-safety/InspectionFindingsCard.tsx', [
  ["  complianceRate: number;\n", "  complianceRate: number | null;\n"],
  ["  const isGoodCompliance = finding.complianceRate >= 90;", "  const isGoodCompliance = finding.complianceRate !== null && finding.complianceRate >= 90;"],
  ["              {finding.complianceRate}%\n", "              {finding.complianceRate === null ? \"—\" : `${finding.complianceRate}%`}\n"],
  ["            value={finding.complianceRate} \n", "            value={finding.complianceRate ?? 0} \n"],
])
