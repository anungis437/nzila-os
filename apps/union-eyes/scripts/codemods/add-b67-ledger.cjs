const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B67-COGNITION-HONESTY-AGGREGATE-GUARDS-AUDIT-AND-SYNC-INTEGRITY'
const all = () => ledger.batches.flatMap((b) => b.items)
const earlier = (start) => all().find((i) => i.prefix.startsWith(start))
const test = A + 'lib/services/__tests__/s11-cognition-and-integrity.test.ts'

if (!ledger.batches.some((x) => x.id === id)) {
  const fresh = (prefix, files, explanation, remaining) => ({ prefix, status: remaining ? 'PARTIAL' : 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, test], explanation, ...(remaining ? { remaining } : {}) })
  const fed = A + 'lib/knowledge-transfer/federated-intelligence/'
  const items = [
    fresh('DEF-0B7-COGA-FEDERATED-PERCENTILE-FROM-UNSOURCED-LITERALS', [fed + 'federated-engine.ts', fed + 'federated-models.ts', fed + '__tests__/federated-engine.test.ts', A + 'components/knowledge-transfer/governance-evolution/governance-evolution-tracker.tsx'],
      'The unsourced percentile table and cohort averages are removed. The result keeps the score bands as a rubric the product defines, reports no percentile (null) and no cohort average, compares each dimension with the midpoint of its own band, and states referenceStatus UNSOURCED_RUBRIC_NO_POPULATION; the screen no longer shows a percentile. The federated-engine test was rewritten for the new fields (disclosed).'),
    fresh('DEF-0B7-EXC-MITIGATION-PROJECTIONS-ARE-FIXED-MULTIPLIERS', [A + 'lib/knowledge-transfer/mitigation-comparison/mitigation-comparator.ts', A + 'lib/knowledge-transfer/mitigation-comparison/mitigation-models.ts', A + 'lib/knowledge-transfer/mitigation-comparison/__tests__/mitigation-comparator.test.ts'],
      'The per-domain confidence is always unvalidated (no band is claimed from the constant), the comparison states basis ASSUMED_EFFECTIVENESS_NOT_CALIBRATED with the assumptions listed, the rationale says it is under those assumptions, and a run in which no scenario reached any node reports noNodesEvaluated, recommends nothing and says so instead of ranking zeroes.'),
    fresh('DEF-0B7-COGB-AGGREGATE-ERRORS-RETURNED-VERBATIM-IN-HTTP-200', [A + 'lib/organizational-operating-intelligence/aggregate-guard.ts', A + 'app/api/exit-interviews/organizational-cognition/route.ts', A + 'app/api/exit-interviews/organizational-narratives/route.ts', A + 'app/api/__tests__/exit-interviews-organizational-cognition.route.test.ts'],
      'Both aggregators report a failed engine by engine, domain and a fixed code (NOT_IMPLEMENTED or ENGINE_FAILED) and never the exception text, state complete false when any engine is missing, and answer 503 when every engine failed. The route test mocks the limiter backend and gained four cases (disclosed).'),
    fresh('DEF-0B7-COGB-AGGREGATE-RUNS-28-ENGINES-PER-REQUEST-UNCACHED', [A + 'lib/organizational-operating-intelligence/aggregate-guard.ts', A + 'app/api/exit-interviews/organizational-cognition/route.ts', A + 'app/api/exit-interviews/organizational-narratives/route.ts'],
      'A run is limited to 12 per minute per organization (shared limiter, refusing when it is unavailable), and a result without failures is reused for 30 seconds from a bounded memo keyed by organization, never shared across organizations.'),
    fresh('DEF-0B7-COGB-SUCCESSION-CALL-NOT-AUDITED', [A + 'lib/knowledge-transfer/succession/succession-analyzer.ts', A + 'app/api/exit-interviews/succession/route.ts', A + 'lib/organizational-operating-intelligence/aggregate-guard.ts'],
      'Verified in source: the analyzer writes requested, completed and failed audit records through persistAtomicAudit naming the acting user; the route now also limits model runs to 10 per hour per organization.'),
    fresh('DEF-0B7-COGB-SUCCESSION-MODEL-OUTPUT-UNVALIDATED', [A + 'lib/knowledge-transfer/succession/succession-analyzer.ts'],
      'Verified in source: the reply is parsed against a zod schema, an unusable reply is audited and answers an error instead of a canned 200 summary, and the report carries modelGenerated.'),
    fresh('DEF-0B3-AUDITS-FABRICATED-ENGAGEMENT-FIELDS', [A + 'app/api/audits/route.ts'],
      'The list states kind audit_log_entries, no longer invents a findings count of 0 or a hasReport flag, and a non-successful entry is unknown instead of an engagement in progress.'),
    fresh('DEF-0B6-EMP-COMMUNICATION-NOT-DELIVERED', [A + 'app/api/employers/communications/route.ts', A + 'app/api/__tests__/employers-communications-atomic-audit.route.test.ts'],
      'The route is stated and answered as recorded only (delivery recorded_only): the sender is no longer the invented System, sentAt is the recorder-stated occurredAt (never in the future) and is no longer stamped by the server. The route test gained cases (disclosed).'),
    fresh('DEF-0B6-EMP-CAPE-AUDIT-EVENT-AFTER-COMMIT', [A + 'app/api/employers/communications/route.ts', A + 'app/api/employers/communications/contacts/route.ts', A + 'app/api/__tests__/employers-communications-atomic-audit.route.test.ts'],
      'The second audit event emitted after the commit (which also carried the contact name) is removed from both routes; the in-transaction audit record is the only one.'),
    fresh('DEF-0B7-EXP-EXTERNAL-DOWNLOAD-BEARER-LINK-NOT-BOUND-TO-GRANT', [A + 'app/api/external/documents/[id]/download/route.ts'],
      'The link lives five minutes instead of sixty, its lifetime is returned and recorded in the audit.',
      'A storage link is still a read-only bearer URL for those minutes and cannot be bound to the caller or recalled when the grant is revoked.'),
    fresh('DEF-0B4-CLAUSE-LIBRARY-EDIT-AND-DELETE-NO-VERSION-OR-RETENTION', [A + 'app/api/clause-library/[id]/route.ts'],
      'A change to the title, text or type raises the version and the audit records the versions and a SHA-256 of the replaced text; a clause shared beyond private is refused deletion (409) until withdrawn from sharing, and the delete audit keeps its title, type, version and text digest.',
      'The replaced text itself is not retained as a prior row (previous_version_id is unused); only its digest is.'),
    fresh('DEF-0B6-SYS-CALENDAR-SYNC-SWALLOWED-EVENT-ERRORS-COUNTED-AS-IMPORTED', [A + 'lib/external-calendar-sync/microsoft-calendar-service.ts'],
      'The Google import already counted failures and threw; the Microsoft import now counts a failed event, no longer counts a failed cancellation as deleted (the handler throws), stores the delta link only when every event was applied, throws MicrosoftCalendarImportError otherwise, and a failed delta-link write is no longer swallowed.'),
    fresh('DEF-0B8-ICRA-CLAIM-BINDS-TO-ANY-SIGNED-IN-USER-ORGANIZATION', [A + 'app/api/icra/[assessmentId]/claim/route.ts', A + 'app/api/__tests__/icra-assessmentId-claim.route.test.ts'],
      'Claiming now requires an organization administrator in addition to the token and a membership; a member is refused before anything is written or audited. The claim test gained a case and a mock (disclosed).',
      'The claim still clears only the claim token: the pseudonymous capability token hash and expiry stay valid, and nothing checks that the claiming organization is the purchaser.'),
  ]
  ledger.batches.push({ id, family: 'Cognition honesty, aggregator guards, audit-list honesty, employer correspondence and calendar-sync integrity', evidenceCommit: null, items })

  const upgrade = (start, add, files) => {
    const item = earlier(start)
    if (!item) throw new Error('no earlier item ' + start)
    item.status = 'IMPLEMENTED_PENDING_QUALIFICATION'
    delete item.remaining
    item.explanation += ' ' + add
    item.files = [...new Set([...item.files, ...files, test])]
  }
  upgrade('DEF-0B7-EXC-DERIVED-VIEWS-IGNORE-SENSITIVITY-AND-CONSENT', 'Verified later: the topic graph, propagation map, resilience index, succession analyzer, risk detector, forecaster and simulator all select through derivedAnalyticsCondition (sensitivity and consent), so the graph query, simulation, scenario and mitigation routes inherit it.', [A + 'lib/knowledge-transfer/governance/interview-access.ts', A + 'lib/knowledge-transfer/topic-graph/topic-graph-builder.ts'])
  upgrade('DEF-0B7-COGB-PROPAGATION-UNKNOWN-NODE', 'Verified and completed: an unknown node is a 404, the query is a strict schema, and each analysis type, node view included, returns only its own section.', [A + 'app/api/exit-interviews/propagation/route.ts'])
  upgrade('DEF-0B7-COGB-INTERVIEW-READS-UNBOUNDED', 'Verified later: the topic graph, propagation map, resilience index and succession analyzer each read at most INTERVIEW_READ_LIMIT (500) published interviews, which also bounds the succession prompt and the tag pairs.', [A + 'lib/knowledge-transfer/governance/interview-read-limit.ts', A + 'lib/knowledge-transfer/topic-graph/topic-graph-builder.ts', A + 'lib/knowledge-transfer/succession/succession-analyzer.ts'])
}
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B67 added')
