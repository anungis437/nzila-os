const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B72-S10-ML-FEEDBACK-TABLE-QUERY-DISCLOSURE-AND-ALIAS-ROUTES'
const test = A + 'lib/services/__tests__/s16-ml-feedback-and-aliases.test.ts'
const all = () => ledger.batches.flatMap((b) => b.items)
const earlier = (start) => all().find((i) => i.prefix.startsWith(start))
const mig = [A + 'db/migrations-platform/0047_ml_prediction_feedback.sql', A + 'db/migrations-platform/0047_ml_prediction_feedback.rollback.sql', A + 'db/migrations-cache/0037_ml_prediction_feedback_rls_closure.sql', A + 'db/migrations-cache/0037_ml_prediction_feedback_rls_closure.rollback.sql', A + 'db/__tests__/platform-0047-ml-prediction-feedback.pglite.test.ts', A + 'db/schema/domains/ml/predictions.ts', A + 'db/rls-storage-authority/analytics-ai.ts', A + 'db/__tests__/rls-storage-authority-registry-composition.test.ts']
const fb = A + 'app/api/ml/predictions/sla-breach-risk/feedback/route.ts'
if (!ledger.batches.some((x) => x.id === id)) {
  const item = (prefix, files, explanation, remaining) => ({ prefix, status: remaining ? 'PARTIAL' : 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, test], explanation, ...(remaining ? { remaining } : {}) })
  ledger.batches.push({
    id,
    family: 'Schema: append-only prediction feedback (0047, cache 0037); ML query disclosure; alias routes; hierarchy list',
    evidenceCommit: null,
    items: [
      item('DEF-0B9-ML-SLA-FEEDBACK-UPDATES-MODEL-METADATA-WHICH-THE-RUNTIME-ROLE', [fb, A + 'app/api/__tests__/sla-breach-risk-feedback.route.pglite.test.ts', A + 'db/schema/index.ts', ...mig],
        'Migration 0047 adds ml_prediction_feedback (one row per prediction by a unique index, tenant RLS by cache 0037, runtime role SELECT and INSERT only). The route records each outcome there and computes the statistics from those rows; model_metadata is never updated, so the permission refusal and the rollback of the audit record under canonical bootstrap no longer occur. The earlier mock-only route test was replaced by a PGlite test of the real statements (disclosed); the s2 pin on the version check was updated (disclosed). Both migrations are UNQUALIFIED and not run on native PostgreSQL; registry count 866 to 867 (disclosed).'),
      item('DEF-0B9-ML-SLA-RETRAIN-SIGNAL-AND-TRAINING-QUEUE', [fb],
        'The training queue (which held each submission\'s comment and submitting user id) is gone; the signal is computed from the recorded rows and returned as a figure with consumedBy null, stating that nothing reads it and the fixed scoring rule has no parameters to retrain.'),
      item('DEF-0B9-ML-QUERY-AUDIT-IS-A-LOG-LINE', [A + 'app/api/ml/query/route.ts', A + 'app/api/__tests__/ml-query.route.test.ts'],
        'The safety check now receives the caller\'s own role and the confidential data class, and a durable in-transaction audit record (length and SHA-256 of the question, not its text) is written before the question leaves; if it cannot be written nothing is sent. The route test replaced the log-line expectation and gained two cases (disclosed).'),
      item('DEF-0B9-ML-QUERY-SENDS-FREE-TEXT-AND-ARBITRARY-CONTEXT', [A + 'app/api/ml/query/route.ts', A + 'app/api/__tests__/ml-query.route.test.ts'],
        'The context is a bounded flat map (at most 20 keys, scalar values) and the body is strict; every disclosure is recorded before it leaves.',
        'No organization-level decision permits or forbids sending free text to the external service; that is an institutional decision.'),
      item('DEF-0B9-ASM-OCI-PATHS-WRAP-THE-OCRA-HANDLERS', [A + 'app/api/oci/intake/route.ts', A + 'app/api/oci/assessment/route.ts', A + 'app/api/oci/results/[id]/route.ts', A + 'app/api/oci/report/[assessmentId]/route.ts'],
        'The four OCI routes are plain re-exports of the OCRA handlers; the local always-true access function and the meaningless method check are removed, so the access decision is the handler\'s own.'),
      item('DEF-0B9-ORG-HIERARCHY-LIST-HARD-CODED-RLS-FLAG', [A + 'app/api/organizations/hierarchy/route.ts', A + 'components/admin/OrganizationHierarchyAdmin.tsx'],
        'The constant rls_enabled flag is removed (the badge it drove no longer shows), the root filter runs in the query before the cap, one extra row is read and the answer states truncated and the limit.'),
    ],
  })
  const upgrade = (start, add, files) => {
    const it = earlier(start)
    if (!it) throw new Error('no earlier item ' + start)
    it.status = 'IMPLEMENTED_PENDING_QUALIFICATION'
    delete it.remaining
    it.explanation += ' ' + add
    it.files = [...new Set([...it.files, ...files, test])]
  }
  upgrade('DEF-0B8-JUR-ALIAS-WRAPPERS-CARRY-AN-ALWAYS-TRUE-ORG-GUARD', 'Completed: the intelligence and governance aliases are plain re-exports and the investigations routes answer 501 (verified).', [A + 'app/api/intelligence/route.ts', A + 'app/api/governance/route.ts', A + 'app/api/investigations/route.ts'])
  upgrade('DEF-0B8-JUR-GEOFENCE-GET-STORES-MEMBER-COORDINATES-WITHOUT-A-CONSENT-CHECK', 'Verified later: checkGeofenceEntry stores a position only when the member has a valid opt-in (with the strike permission for a strike fence) and tracking is enabled.', [A + 'services/geofence-privacy-service.ts'])
}
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B72 added')
