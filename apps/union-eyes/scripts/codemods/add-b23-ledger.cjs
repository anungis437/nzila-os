const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B23-F11-AI-AND-MODEL-OUTPUT-GOVERNANCE'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B23 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const CONTRACT = A + 'lib/api/__tests__/f11-ai-governance.contract.test.ts'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F11: model output is shown as what it is: no canned reply stored as a model answer, no value typed into a provenance field, scoring before limiting, and feedback that counts a case once',
  evidenceCommit: null,
  items: [
    item('DEF-0B3-ANALYTICS-ROWS-FORGE-AI-PROVENANCE', [A + 'app/api/analytics/insights/route.ts', A + 'app/api/__tests__/analytics-insights.route.test.ts'],
      'A create answers 501, so no AI reference id, confidence score or data source can be typed into a stored insight. The only change a person makes is a triage (acknowledge, start, complete, dismiss with a reason) on an existing insight, stamped with their identity and the server clock, guarded by a transition table and a status predicate, and audited in the same transaction. The panel\'s PATCH, which had no route behind it, now has one.'),
    item('DEF-0B3-WEEKLY-SUMMARY-FABRICATED-MODEL-CLAIM', [A + 'app/api/analytics/insights/weekly-summary/route.ts', A + 'app/api/__tests__/analytics-weekly-summary.route.test.ts', CONTRACT],
      'The weekly summary is a deterministic seven-day aggregate that says so (aiUsed false, no AI reference, no confidence) (upstream\'s change, existing test and contract).'),
    item('DEF-0B2-AI-CACHE-PLATFORM-WIDE-ORG-ADMIN', [A + 'app/api/ai/cache-stats/route.ts', A + 'app/api/__tests__/ai-cache-stats.route.test.ts', CONTRACT],
      'Embedding cache statistics need platform system-administrator authority and are audited (batch B18).'),
    item('DEF-0B4-CHATBOT-FALLBACK-PRESENTED-AS-AI-REPLY', [A + 'lib/ai/chatbot-service.ts', A + 'app/api/chatbot/messages/route.ts', A + 'lib/ai/__tests__/chatbot-service.test.ts'],
      'A failed generation raises ChatbotUnavailableError (a 502 from the route) and stores nothing; it no longer saves a canned apology as an assistant message from the model "fallback". Test disclosure: the test that asserted the stored fallback was replaced. The ai-client mock lacked buildOrgAiTrace, so the other sendMessage tests had been passing on that canned reply; the mock now provides it and those tests exercise a real generation.'),
    item('DEF-0B4-CHATBOT-RAG-LIMITS-BEFORE-SCORING', [A + 'lib/ai/chatbot-service.ts', A + 'lib/ai/__tests__/chatbot-service.test.ts'],
      'The search scores a bounded candidate set (500 rows) and applies the requested limit to the best matches; a row with a missing or unreadable embedding is skipped instead of throwing; a threshold of 0 is honoured.'),
    item('DEF-0B9-ML-SLA-FEEDBACK-IS-REPEATABLE-CALLER-STATED-VERSION-UNBOUND-AND-A-LOST-UPDATE-READ-MODIFY-WRITE', [A + 'app/api/ml/predictions/sla-breach-risk/feedback/route.ts', A + 'app/api/__tests__/sla-breach-risk-feedback.route.test.ts'],
      'The model row is locked for the read-modify-write; a prediction is scored once (409 on a repeat); feedback no longer creates a model under a version the caller names (404), and a prediction that records its own version is scored only against it.',
      { status: 'PARTIAL', remaining: 'The SLA prediction rows written by the prediction route carry no model version column, so the version binding applies only where the stored prediction has one.' }),
    item('DEF-0B8-JUR-LOCATION-CONSENT-TEXT-AND-PURPOSE-ARE-CLIENT-SUPPLIED-AND-UNVALIDATED', [A + 'app/api/location/consent/route.ts', A + 'app/api/__tests__/location-consent.route.test.ts'],
      'The body is parsed with a typed, bounded schema: purpose, description and text are non-empty bounded strings and the two allowance flags must be booleans (a string "false" was stored as consent); an invalid or non-JSON body is a 400 that records no consent.',
      { status: 'PARTIAL', remaining: 'The consent text and purpose are still supplied by the client; a server-owned notice with a version the member acknowledges needs a client change.' }),
    item('DEF-0B9-ML-ALERTS-DRIFT-FINDING-IS-A-LITERAL-PSI-AND-ALERT-IDS-CHANGE-EVERY-SECOND', [A + 'app/api/ml/monitoring/alerts/route.ts', CONTRACT],
      'The monitoring alerts route answers 501 (batch B15); no literal drift value or per-second alert id is returned.'),
    item('DEF-0B9-ML-ALERT-ACKNOWLEDGE-GUID-NEVER-MATCHES-A-GENERATED-ID-AND-THE-ACKNOWLEDGEMENT-IS-KEYED-ON-THE-ID-ALONE', [A + 'app/api/ml/monitoring/alerts/route.ts', CONTRACT],
      'The same route answers 501, so there is no acknowledgement to key on an id alone.'),
    item('DEF-0B9-ML-CHURN-PROFILES-NAMED-MEMBERS-FROM-THEIR-CASE-HISTORY-WITH-NO-CONSENT-OR-PURPOSE-DECISION', [A + 'app/api/ml/predictions/churn-risk/route.ts', CONTRACT],
      'The churn-risk route answers 501 (batch B10); no member is profiled from case history.'),
    item('DEF-0B6-EDU-ITEM-FACADES-REWRITE-OR-DELETE-COURSE-BY-PATH-ID', [A + 'app/api/education/programs/[id]/enrollments/route.ts', CONTRACT],
      'The program enrolment item answers 501 for every method, so a program id can no longer rewrite or delete a training course.'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B23 added')
