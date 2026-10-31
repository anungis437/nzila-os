const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
addBatch({
  id: 'B109-F06-A5-A7-CLAIMED-CONTROLS-OPERATE',
  family: 'F06 A5 + A7: a control the code names is the control that operates (AI control plane, external reads, report fields, claim binding, entitlement)',
  test: A + 'lib/services/__tests__/s51-f06-a5-a7-claimed-controls-operate.test.ts',
  previousEvidence: { 'B108-F06-A3-DURABLE-OPERATION-LIFECYCLES': 'c0d9e5ad7' },
  items: [
    {
      prefix: 'DEF-0B4-CHATBOT-MODERATION-BYPASSES-AI-CONTROL-PLANE',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'lib/ai/chatbot-service.ts', A + 'lib/ai/ai-client.ts', 'scripts/seed-ai-profiles-ue.sql', A + 'lib/ai/__tests__/chatbot-service.test.ts', A + 'lib/ai/__tests__/chatbot-moderation-fail-closed.contract.test.ts'],
      explanation: 'Moderation no longer posts member text to api.openai.com with a provider key. It is a generate call through @nzila/ai-sdk under its own profile (ue-chatbot-moderation), with the message classed member_personal (sensitive at the gateway) so the control plane applies its data-class, budget, guardrail and audit controls like any other AI call. The prompt delimits the member text as data, the answer must be one well-formed JSON verdict, unknown categories are dropped and an unclassified flag is recorded as unspecified; a refused call, an unparseable or ill-typed answer all fail closed to "safety system unavailable" before retrieval or generation. The provider-key branch tests were replaced (disclosed); the OPENAI_API_KEY and fetch stubs are gone and a test asserts no direct fetch.',
      remaining: 'The ue-chatbot-moderation profile must be seeded in the control plane (scripts/seed-ai-profiles-ue.sql adds it; until it exists every message fails closed). A general-purpose model classifying safety is not qualified against the dedicated moderation endpoint it replaces; no provider was exercised.',
    },
    {
      prefix: 'DEF-0B8-FED-EXTERNAL-DECISION-AUDIT-SEPARATE-AND-BEST-EFFORT',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'lib/external-resource-middleware.ts', A + 'lib/services/external-resource-authorization-service.ts', A + 'app/api/external/documents/[id]/download/route.ts', A + 'app/api/external/__tests__/external-routes.test.ts'],
      explanation: 'A successful external read is now recorded: the middleware writes external.resource.read on the same transaction the read ran on, carrying the authorization decision it rested on (authority, matter grant, permission, method, status, the resource id), after the handler and before the response is released; a record that cannot be written abandons the transaction and the outside party receives nothing. The separate allowed-decision row for a read is folded into that record, so a document request no longer writes a matter decision row and a document decision row for the same matter. Refusals are still recorded by the decision service; the download keeps its own, more specific record (bytes delivered).',
      remaining: 'Writes by an external party keep a separate allowed-decision row, and the document-level decision is still its own row next to the read record.',
    },
    {
      prefix: 'DEF-0B11-RPT-EXECUTE-RETURNS-MEMBER-EMAIL',
      status: 'PARTIAL',
      files: [A + 'lib/reports/report-config-validation.ts', A + 'app/api/reports/execute/route.ts', A + 'app/api/__tests__/reports-execute.route.test.ts'],
      explanation: 'Field-level authority: an officer may run aggregate reports, but listing claim or claim-deadline rows, and selecting, grouping, filtering or sorting on member e-mail (a filter is a search oracle over addresses), need an administrator. The refusal is recorded (report.execute.denied) and nothing is run; an officer\'s page is capped at 500 rows; the success record names the administrator-only selections and the limit. Six tests added; the existing mechanics tests run as an administrator (disclosed).',
      remaining: 'No classification or consent check on the returned fields and no small-group suppression on aggregates.',
    },
    {
      prefix: 'DEF-0B8-ICRA-CLAIM-BINDS-TO-ANY-SIGNED-IN-USER',
      status: 'PARTIAL',
      files: [A + 'app/api/icra/[assessmentId]/claim/route.ts', A + 'app/api/__tests__/icra-assessmentId-claim.route.test.ts'],
      explanation: 'The claim is bound to the purchaser: the paid-tier webhook records the buyer\'s e-mail on the assessment, and the claiming account\'s own e-mail must equal it (case-insensitive), as part of the single conditional write that consumes the token. An account without a verified e-mail, a different e-mail, or an assessment with no recorded purchaser cannot claim it (403, nothing consumed or audited); the audit row records that the purchaser e-mail matched.',
      remaining: 'The pseudonymous capability token is still valid after the claim, because every ICRA read route authorizes only through that capability and no account-based access path exists for a claimed assessment; revoking it would lock the claiming organization out.',
    },
    {
      prefix: 'DEF-0B12-PLT-VOICE-TRANSCRIBE-HAS-NO-RATE-LIMIT',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'app/api/voice/transcribe/route.ts', A + 'app/api/__tests__/voice-transcribe.route.test.ts'],
      explanation: 'The transcription route now applies the same entitlement as the sibling upload route before it reads or sends the recording (403 with the upgrade path, nothing audited or sent). With the per-user rate limit and the audit record written before the audio leaves (earlier batches), all three named gaps are closed.',
      remaining: 'Another contributor is changing this route and its tests (disclosure consent): two of their existing tests (voice-upload and voice-transcribe disclosure refusals expecting 400, receiving 409) and the f06 pin on the earlier audit action name fail at HEAD independently of this change.',
    },
    {
      prefix: 'DEF-0B12-WBK-MEMORY-HOLDER-ROUTES-ACCEPT',
      status: 'PARTIAL',
      files: [A + 'app/api/workbook/[id]/memory-holders/[holderId]/route.ts', A + 'app/api/workbook/[id]/memory-holders/[holderId]/__tests__/route.test.ts'],
      explanation: 'A miss on a claimed workbook (a PATCH or DELETE that matched no holder) is recorded as an attempt (update_not_found, delete_not_found) rather than leaving no trace. The collection and item routes are behind the public-intake guard and the per-workbook cap of 200 holders was already in place. Two tests that pinned "a miss records nothing" were replaced (disclosed).',
      remaining: 'An unclaimed workbook has no tenant or actor to attribute a record to, so its bearer-identifier reads and writes still leave none; that is the pseudonymous design and attributing it needs a decision on a platform-level pseudonymous trail.',
    },
    {
      prefix: 'DEF-0B12-WBK-ANY-MEMBER-OF-THE-CLAIMING-ORGANIZATION',
      status: 'PARTIAL',
      files: [A + 'app/api/workbook/[id]/memory-holders/[holderId]/route.ts', A + 'app/api/workbook/[id]/memory-holders/[holderId]/__tests__/route.test.ts'],
      explanation: 'The steward role floor from B102 stands; the PATCH and DELETE audit rows are no longer written only when a row changed: an attempt that changed nothing is recorded as such.',
      remaining: 'The named people still have no notice that they are recorded; how and by whom they are told is an institutional and legal decision no code can make.',
    },
  ],
})
