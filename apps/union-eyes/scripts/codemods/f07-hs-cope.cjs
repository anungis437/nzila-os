const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 60)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}

edit('app/api/cope/campaigns/route.ts', [[
  "  readRole: 'member',\n  writeRole: 'steward',\n",
  "  readRole: 'member',\n  writeRole: 'steward',\n  // The amount raised, the status and the payment-provider identifiers come from recorded donations and the provider, never from a steward's body.\n  writableFields: ['title', 'slug', 'description', 'campaignType', 'goalAmount', 'currency', 'startDate', 'endDate', 'allowRecurring', 'suggestedAmounts', 'thankYouMessage'],\n",
]])

const WORKFLOW = 'A status or outcome is the result of the workflow that investigates, verifies or closes the record, so a generic PATCH may not set it.'
edit('app/api/health-safety/incidents/[id]/route.ts', [[
  "  writeRole: 'admin',\n",
  `  writeRole: 'admin',\n  // ${WORKFLOW}\n  blockedPatchFields: ['status', 'closedDate', 'investigationStartDate', 'investigationCompletedDate', 'investigationReport', 'wsibClaimStatus'],\n`,
]])
edit('app/api/health-safety/hazards/[id]/route.ts', [[
  "  writeRole: 'admin',\n",
  `  writeRole: 'admin',\n  // ${WORKFLOW}\n  blockedPatchFields: ['status', 'closedDate', 'verifiedById', 'verifiedByName', 'verifiedDate', 'riskAssessmentCompleted', 'likelihoodScore', 'severityScore', 'riskScore'],\n`,
]])
edit('app/api/health-safety/inspections/[id]/route.ts', [[
  "  writeRole: 'admin',\n",
  `  writeRole: 'admin',\n  // ${WORKFLOW}\n  blockedPatchFields: ['status', 'completedDate', 'itemsPassed', 'scorePercentage', 'followUpCompleted'],\n`,
]])
console.log('ok')
