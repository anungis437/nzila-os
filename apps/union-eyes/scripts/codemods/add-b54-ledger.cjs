const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B54-F12-REFERENCES-AND-FIGURES-STATE-WHAT-THEY-ARE'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'lib/kpi/__tests__/b54-references-and-figures.test.ts'
  const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, test], explanation, ...extra })
  ledger.batches.push({
    id,
    family: 'F12: referenced ids belong to the right parent, and a figure with nothing to measure is unknown rather than 0 or 100',
    evidenceCommit: null,
    items: [
      item('DEF-0B12-PLT-KPI-HEALTH-TREATS-A-LOWER-FIGURE-AS-WORSE-FOR-EVERY-TARGET', [A + 'lib/kpi/health.ts', A + 'app/api/targets/summary/route.ts'],
        'Target health now reads its direction from the thresholds: critical above warning above target means lower is better, and the comparison flips; otherwise higher is better as before. A missing or non-finite value or target is no_data. Pure unit tests cover both directions.',
        { status: 'PARTIAL', remaining: 'The direction is inferred from threshold order because no direction column exists; a column is the proper fix. The current value is still the latest row of the metric type.' }),
      item('DEF-0B3-TENTATIVE-AGREEMENT-REFERENCES-UNVERIFIED', [A + 'app/api/bargaining/tentative-agreements/route.ts'],
        'relatedProposalIds are now an array of at most 50 ids, each of which must be a proposal of the same negotiation, and relatedClauseId must be a clause of an agreement of the caller organization (404 otherwise, nothing written). Existing route tests pass.'),
      item('DEF-0B4-OHS-FILINGS-OWNER-FILTER-INCONSISTENT', [A + 'app/api/cnesst/filings/route.ts'],
        'The filings collection sets staffReadsAll, so the member-id owner scope applies only below the steward floor and a steward reads the organization filings, as the item routes already allow.'),
      item('DEF-0B6-CMP-LEADERSHIP-COMPLIANCE-DEFAULTS-TO-100-AND-TRUNCATES', [A + 'lib/services/dashboard-kpi-service.ts', A + 'lib/services/__tests__/dashboard-kpi-service.test.ts', A + 'components/leadership/compliance-summary-card.tsx'],
        'Deadline adherence and documentation rate are null, not 100, when there is nothing to measure, and the card shows a dash in a neutral colour. The empty-input service test pinned the 100 and was changed to expect null (disclosed).',
        { status: 'PARTIAL', remaining: 'No code inserts compliance alerts, and the grievance aggregates still stop at the first 5000 rows.' }),
      item('DEF-0B8-HS-UNMEASURED-VALUES-COERCED-TO-ZERO', [A + 'app/api/health-safety/inspections/findings/route.ts', A + 'components/health-safety/InspectionFindingsCard.tsx'],
        'The inspection findings list reports a missing score as null (shown as a dash) instead of 0%. The statistics and dashboard routes already reported unmeasured values as null (existing implementation, existing tests pass).'),
      item('DEF-0B6-EMP-CONTACT-PRIMARY-NOT-EXCLUSIVE', [A + 'app/api/employers/communications/contacts/route.ts'],
        'Adding a primary contact demotes the employer previous primary contact in the same transaction, so at most one is primary per create.',
        { status: 'PARTIAL', remaining: 'No unique index enforces it, so two concurrent creates could still both be primary.' }),
      item('DEF-0B5-OHS-OWNER-COLUMN-WORKERID-ABSENT', [A + 'app/api/cnesst/preventive-withdrawals/route.ts', A + 'app/api/cnesst/right-of-refusal/route.ts'],
        'Existing implementation, verified by a new test: neither collection declares an owner column the table lacks, so no declared-but-unapplied owner condition remains.'),
      item('DEF-0B4-CALENDAR-EVENT-CALENDAR-ID-UNVERIFIED', [A + 'app/api/calendar/events/route.ts'],
        'Existing implementation, verified by a new test: event create checks the calendar belongs to the caller organization and is not another member personal calendar (404).',
        { status: 'PARTIAL', remaining: 'The event update route does not re-check a changed calendarId.' }),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B54 added')
