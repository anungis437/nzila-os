import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// DEF-0B9-ML-MONITORING-METRICS-QUERY-ABSENT-COLUMNS-AND-JOIN-MODEL-METADATA-WITHOUT-AN-ORGANIZATION-
// PREDICATE, DEF-0B9-ML-MONITORING-METRICS-SUBSTITUTE-LITERAL-FIGURES-AND-REPORT-HEALTHY-WHEN-NOTHING-
// IS-MEASURED: pins the fix as a source contract (mirrors lib/api/__tests__/f12-communications.contract.
// test.ts's style) rather than mocking drizzle-orm's `sql` tagged-template internals.
const source = readFileSync(join(__dirname, '..', 'ml', 'monitoring', 'metrics', 'route.ts'), 'utf8')
// The query text only - the response-shaping object below it legitimately names precision/recall/f1Score
// as always-null fields, which is the correct behaviour, not a column reference to check against.
const queryText = source.slice(source.indexOf('db.execute(sql`'), source.indexOf('`);', source.indexOf('db.execute(sql`')))

describe('ml/monitoring/metrics route', () => {
  it('never names a column the declared schema does not have (model_metadata has no precision/recall/f1_score/baseline_accuracy/baseline_confidence; ml_predictions has no predicted_at/prediction_correct/assignment_accepted)', () => {
    for (const absentColumn of [
      'precision', 'recall', 'f1_score', 'baseline_accuracy', 'baseline_confidence',
      'predicted_at', 'prediction_correct', 'assignment_accepted',
    ]) {
      expect(queryText).not.toContain(absentColumn)
    }
  })

  it('scopes both the model_metadata read and its correlated ml_predictions subqueries to the caller organization', () => {
    expect(source).toMatch(/model_metadata\s+mm\s*[\s\S]*?WHERE\s+mm\.organization_id\s*=/i)
    // Both correlated subqueries must join back to the SAME organization, not just the same model_type.
    const subqueryMatches = source.match(/FROM ml_predictions mp\s+WHERE[\s\S]*?mp\.organization_id\s*=\s*mm\.organization_id/g) ?? []
    expect(subqueryMatches.length).toBe(2)
  })

  it('runs inside the caller organization tenant transaction (rlsOrgContext), not the bare shared db handle', () => {
    expect(source).toMatch(/rlsOrgContext:\s*true/)
  })

  it('never fabricates an unevaluated precision/recall/F1/status/trend value', () => {
    expect(source).toMatch(/precision:\s*null/)
    expect(source).toMatch(/recall:\s*null/)
    expect(source).toMatch(/f1Score:\s*null/)
    expect(source).toMatch(/status:\s*'not_evaluated'/)
    expect(source).toMatch(/trend:\s*'unknown'/)
    // A model with no measurements must not be coalesced to a plausible-looking default figure.
    expect(source).not.toMatch(/COALESCE\([^)]*,\s*0\.[0-9]/i)
  })

  it('leaves accuracy and lastUpdated null rather than substituting a computed default when the database has no value', () => {
    expect(source).toMatch(/accuracy:\s*row\.accuracy == null \? null/)
    expect(source).toMatch(/lastUpdated:\s*row\.last_evaluated_at \?\? null/)
    // Never silently turn a missing timestamp into "now".
    expect(source).not.toMatch(/last_evaluated_at.*new Date\(\)/)
  })
})
