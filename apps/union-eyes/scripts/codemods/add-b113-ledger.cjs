const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
addBatch({
  id: 'B113-F06-R2-REPORT-FIELD-AUTHORITY',
  family: 'F06 R2: report field authority, classification and anti-reconstruction',
  test: A + 'lib/reports/__tests__/report-field-authority.test.ts',
  previousEvidence: { 'B112-F06-R1-ICRA-OWNERSHIP-AND-CAPABILITY-REVOCATION': 'a18276a62' },
  items: [
    {
      prefix: 'DEF-0B11-RPT-EXECUTE-RETURNS-MEMBER-EMAIL',
      status: 'PARTIAL',
      files: [
        A + 'lib/reports/report-field-authority.ts',
        A + 'lib/reports/report-disclosure-limits.ts',
        A + 'lib/reports/report-config-validation.ts',
        A + 'lib/report-executor.ts',
        A + 'app/api/reports/execute/route.ts',
        A + 'app/api/__tests__/reports-execute.route.test.ts',
        A + 'lib/reports/__tests__/report-disclosure.pglite.test.ts',
        A + 'lib/__tests__/report-executor.test.ts',
      ],
      explanation: 'Field authority and classification: every (table, column) of the reporting registry carries an information class (identifier, financial, matter, member attribute, operational; an unknown column is an identifier), the same shape as the authority kernel\'s document classes. An officer may count and group by non-identifying dimensions; identifiers cannot be selected, grouped, filtered, sorted or having-filtered, nor min/max/summed; matter, financial and member columns cannot be listed row by row; only operational columns can. The assessment resolves what SQL will actually use, which closed four bypasses: a `distinct` aggregation that the executor ran as a plain column (the executor now refuses an unknown aggregation, and `distinct` is translated to count_distinct), another table\'s rows listed through a join from an allowed source, a filter whose executor-side column differs from the id the route validated, and bare columns that exist in several joined tables. Cell size is measured by the server on distinct rows and distinct people (qualified to the base table, valid on joins) for grouped reports and for ungrouped aggregates; a withheld lone cell also withholds the smallest released neighbour. A per-organization, per-officer, per-question-shape budget (12 an hour) bounds repeated-question probing and refuses with a recorded denial. The audit row records the fields, filters, groups and sorts by table.column, the classes returned, the authority, the policy version and its approval state (none), the question shape and withheld counts, never a filter value or a row. Proven on PGlite real SQL over two organizations (counts never cross organizations, distinct-people suppression, joins) and in route tests.',
      remaining: 'No institution has approved the field-class policy: it is the provisional conservative default (approvedBy null), so the offices that may reproduce member or claim columns are not yet named by a decision. Consent for member contact fields is not modelled. Cross-report differencing is bounded (cell size, complementary suppression, per-shape budget, recorded shapes), not eliminated.',
    },
  ],
})
