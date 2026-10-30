const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
const READ = "  readRole: 'member',\n"

// Bargaining units: the working notes and custom fields stay internal, and certification and representation facts do not come from a steward's body.
const UNIT_BLOCK = "'certificationNumber', 'certificationDate', 'certificationBody', 'certificationExpiryDate', 'currentCollectiveAgreementId', 'chiefStewardId', 'bargainingChairId', 'status', 'memberCount', 'archivedAt'"
edit('app/api/units/route.ts', [[
  "  readRole: 'member',\n  writeRole: 'steward',\n",
  "  readRole: 'member',\n  writeRole: 'steward',\n  // Working notes and custom fields are not part of the unit's public record.\n  omitFromResponse: ['notes', 'customFields'],\n  // Certification, representation and lifecycle facts come from the certification and the roster, not from a steward's body.\n  writableFields: ['employerId', 'worksiteId', 'name', 'unitNumber', 'unitType', 'classifications', 'title', 'description', 'contractExpiryDate', 'nextBargainingDate'],\n",
]])
edit('app/api/units/[id]/route.ts', [[
  "  readRole: 'member',\n  writeRole: 'steward',\n",
  `  readRole: 'member',\n  writeRole: 'steward',\n  omitFromResponse: ['notes', 'customFields'],\n  // Certification, representation and lifecycle facts come from the certification and the roster, not from a steward's body.\n  blockedPatchFields: [${UNIT_BLOCK}],\n`,
]])

// Worksites: the site manager's contact details and the working notes are not a directory entry.
for (const f of ['app/api/worksites/route.ts', 'app/api/worksites/[id]/route.ts']) {
  edit(f, [[
    "  readRole: 'member',\n",
    "  readRole: 'member',\n  // The site manager's name, e-mail and telephone, the notes and the custom fields are working records, not a directory entry.\n  omitFromResponse: ['siteManagerName', 'siteManagerEmail', 'siteManagerPhone', 'notes', 'customFields'],\n",
  ]])
}

// WCB assessments carry the premium rate, the assessable payroll and the premium due.
for (const f of ['app/api/wcb/assessments/route.ts', 'app/api/wcb/assessments/[id]/route.ts']) {
  edit(f, [[
    "  readRole: 'steward',\n",
    "  // Premium rate, assessable payroll and premium due are the organization's financial position: an officer reads them.\n  readRole: 'officer',\n",
  ]])
}

// Facades that advertise a capability the generic factory cannot serve.
edit('scripts/codemods/f02-domain-facades-501.cjs', [[
  "  'events/[id]/occurrences':",
  `  'wcb/claims': 'the generic CRUD factory over WCB claims, which the governance policy denies for every caller (so it refused every request)',
  'wcb/claims/[id]': 'the generic CRUD factory over WCB claims, which the governance policy denies for every caller (so it refused every request)',
  'social-media/feed': 'the generic CRUD factory over the communications campaigns table (no social post or feed exists behind it)',
  'external-data': 'the generic CRUD factory over external accounts, which the governance policy denies for every caller (so it refused every request)',
  'external-data/lrb': 'the generic CRUD factory over external accounts under a labour-board name (no labour-board data is read)',
  'integrations/api-keys': 'the generic CRUD factory over integration API keys, which the governance policy denies for every caller (so it refused every request)',
  'events/[id]/occurrences':`,
]])
edit('lib/api/__tests__/roster-facades.contract.test.ts', [[
  "'reports/builder', 'reports/scheduled',",
  "'wcb/claims', 'wcb/claims/[id]', 'social-media/feed', 'external-data', 'external-data/lrb', 'integrations/api-keys', 'reports/builder', 'reports/scheduled',",
]])
console.log('ok')
