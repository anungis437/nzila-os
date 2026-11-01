const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B22-F08-PUBLIC-ROUTE-CONTROLS-AND-PROJECTION'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B22 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const LIMITERS = A + 'lib/api/__tests__/f08-public-limiters.contract.test.ts'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F08: public routes are bounded by a shared limiter keyed on a trusted address, bearer identifiers stay out of logs, and responses carry a projection rather than the stored row',
  evidenceCommit: null,
  items: [
    item('DEF-0B8-ICRA-RATE-LIMITS-PER-PROCESS-AND-KEYED-ON-REQUEST-HEADER-ADDRESS', [A + 'lib/public-intake/guard.ts', A + 'lib/public-intake/__tests__/guard.test.ts', A + 'app/api/icra/[assessmentId]/answer/route.ts', A + 'app/api/icra/[assessmentId]/capability/exchange/route.ts', A + 'app/api/icra/email-results/route.ts', A + 'app/api/icra/submit/route.ts', A + 'app/api/icra/telemetry/route.ts', A + 'app/api/icra/results/[id]/route.ts', LIMITERS],
      'Every ICRA limiter now uses the shared (Redis) limiter, failing closed in production, and keys on one trusted client address: the edge header, else the forwarded-for entry at the configured number of trusted hops from the right (TRUSTED_PROXY_HOPS, default 1), never the client-typed first entry. A ratchet fails if a public route imports the per-process limiter. Test disclosure: the guard test that expected the leftmost forwarded-for entry was replaced, the exchange 21-call test was replaced by two limiter tests, and the answer, submit, results and telemetry tests now mock the shared limiter.',
      { status: 'PARTIAL', remaining: 'x-real-ip is still trusted when present, which is correct only behind a platform that overwrites it; the deployment must be configured so.' }),
    item('DEF-0B10-PIL-PUBLIC-APPLICATION-RATE-LIMIT-IS-KEYED-ON-THE-FIRST-FORWARDED-FOR-VALUE-THE-CLIENT-CAN-SUPPLY', [A + 'app/api/pilot/apply/route.ts', A + 'lib/public-intake/guard.ts', LIMITERS],
      'The pilot application limiter keys on the trusted client address instead of the first forwarded-for value.'),
    item('DEF-0B12-WBK-PUBLIC-START-AND-CHECKOUT-ARE-LIMITED-BY-A-REQUEST-HEADER-ADDRESS-WITH-NO-BOT-CHALLENGE', [A + 'lib/public-intake/guard.ts', A + 'lib/public-intake/__tests__/guard.test.ts'],
      'The workbook start and checkout buckets key on the trusted address (they use the shared guard).',
      { status: 'PARTIAL', remaining: 'There is still no bot challenge on workbook start or checkout.' }),
    item('DEF-0B8-ICRA-EMAIL-RESULTS-SENDS-THE-BEARER-CAPABILITY-TO-ANY-TYPED-ADDRESS', [A + 'app/api/icra/email-results/route.ts', A + 'components/icra/EmailResultsCard.tsx', A + 'app/api/__tests__/icra-email-results.route.test.ts'],
      'The link is mailed only after the respondent acknowledges that anyone holding it can open the results (a required checkbox in English and French; the route answers 400 without acknowledgeLinkAccess), on a durable rate limit. The capability, the ownership proof and the no-storage rule are unchanged.'),
    item('DEF-0B9-ASM-OCRA-EMAIL-RESULTS-PATH-MAILS-THE-BEARER-CAPABILITY-TO-ANY-TYPED-ADDRESS-WITH-NO-DISCLOSURE-DECISION', [A + 'app/api/ocra/email-results/route.ts', A + 'app/api/icra/email-results/route.ts', A + 'app/api/__tests__/ocra-aliases.route.test.ts'],
      'The OCRA path re-exports the ICRA route, so it carries the same acknowledgement requirement and limiter.'),
    item('DEF-0B8-ICRA-MALFORMED-IDS-AND-ANSWER-VALUES-SURFACE-AS-SERVER-ERRORS', [A + 'lib/icra/assessment-id.ts', A + 'app/api/icra/[assessmentId]/answer/route.ts', A + 'app/api/__tests__/icra-assessmentId-answer.route.test.ts', A + 'app/api/__tests__/icra-capability-exchange.route.test.ts'],
      'A path value that is not a UUID is a 404 in the answer, claim, profile, submit and exchange routes before any limiter or query; an answer value the question cannot take, or a note the deployment forbids, is a 400 and touches no row. Test disclosure: the ICRA route tests now use a real UUID where they used the string a1.'),
    item('DEF-0B12-WBK-CHECKOUT-REDIRECT-BASE-FALLS-BACK-TO-LOCALHOST-AND-EVERY-CALL-OPENS-A-NEW-SESSION', [A + 'app/api/workbook/checkout/route.ts', A + 'app/api/__tests__/workbook-checkout.route.test.ts'],
      'Production refuses to open a session without NEXT_PUBLIC_APP_URL (503) and the session is created with an idempotency key per workbook, tier and 30-minute window, so a repeat reuses it.'),
    item('DEF-0B12-WBK-CLAIM-HAS-NO-RATE-LIMIT-AND-READS-AN-UNCAPPED-BODY', [A + 'app/api/workbook/[id]/claim/route.ts', A + 'app/api/__tests__/workbook-id-claim.route.test.ts'],
      'The claim runs through the public-intake guard: rate limited (429, or 503 when the limiter is down in production) and body capped (413) before it is parsed.'),
    item('DEF-0B12-WBK-ROUTES-LOG-THE-BEARER-WORKBOOK-ID', [A + 'lib/icra/opaque-ref.ts', A + 'app/api/workbook/checkout/route.ts', A + 'app/api/workbook/[id]/claim/route.ts', A + 'app/api/workbook/[id]/export/route.ts', A + 'app/api/workbook/start/route.ts', A + 'app/api/__tests__/workbook-id-claim.route.test.ts', A + 'app/api/__tests__/workbook-checkout.route.test.ts'],
      'Workbook routes log a one-way 12-character reference of the identifier, never the identifier, which acts as a capability. Test disclosure: the claim test expectations for the two log calls changed to the reference.'),
    item('DEF-0B11-PRP-REDEMPTIONS-GET-RETURNS-WHOLE-ROWS-INCLUDING-THE-PROVIDER-PAYLOAD', [A + 'app/api/rewards/redemptions/route.ts', A + 'app/api/__tests__/rewards-redemptions-list.route.test.ts'],
      'The list omits the provider payload and checkout identifier, and a non-numeric or negative page request becomes the bounded default instead of NaN.'),
    item('DEF-0B12-PLT-QUEUE-STATUS-SERVICE-KEY-IS-THE-SHARED-AI-KEY-COMPARED-WITH-A-PLAIN-EQUALITY', [A + 'app/api/union-eyes/queue-status/route.ts', A + 'app/api/__tests__/queue-status.route.test.ts'],
      'The service key is compared in constant time; a wrong, short or empty key falls to the platform-administrator path.',
      { status: 'PARTIAL', remaining: 'The control plane still authenticates with the shared AI service key rather than a key dedicated to queue status.' }),
    item('DEF-0B9-ORG-ROSTER-POST-DUPLICATE-USER-ID-AND-INVALID-JSON-HANDLING-LEAVES-UNHANDLED-ERRORS', [A + 'app/api/organizations/[id]/members/route.ts', A + 'app/api/__tests__/organizations-read-authority.pglite.test.ts'],
      'A user already on the roster is a 409 with the one row kept, proven on real SQL against the unique membership index; invalid JSON was already a 400.'),
    item('DEF-0B6-CMP-DEBUG-ROUTE-REACHABLE-IN-PRODUCTION', [A + 'app/api/debug/user-role/route.ts', A + 'lib/api/__tests__/roster-facades.contract.test.ts'],
      'The debug route answers 501 and returns no roster rows (batch B09), pinned by the facade contract test.'),
    item('DEF-0B12-CRUD-TESTIMONIAL-ITEM-READ-IGNORES-VISIBILITY-AND-APPROVAL', [A + 'app/api/testimonials/[id]/route.ts', A + 'app/api/__tests__/wave1-route-floors.test.ts'],
      'The unscoped draft item is read and written only at the platform content-manager floor, so a member cannot fetch an unpublished testimonial by id (upstream\'s change, existing floor test).'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B22 added')
