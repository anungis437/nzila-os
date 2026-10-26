/**
 * Human triage overlay for the 91 source finding entries. Hand-authored; the
 * builder joins it to the parsed sources and to executed test results. A test
 * tag listed here that has no passing test is a build error, so a finding can
 * never cite evidence that does not exist.
 */
export type Route = 'WORKAID_PREP' | 'CODEX_PLATFORM' | 'PROFESSIONAL_VALIDATION' | 'SECURITY_PRIVACY_LEGAL' | 'PILOT_MEASUREMENT' | 'UX_ACCESSIBILITY';

const R: Record<string, Route> = {
  W: 'WORKAID_PREP',
  C: 'CODEX_PLATFORM',
  P: 'PROFESSIONAL_VALIDATION',
  S: 'SECURITY_PRIVACY_LEGAL',
  M: 'PILOT_MEASUREMENT',
  U: 'UX_ACCESSIBILITY',
};

export interface Overlay {
  readonly title: string;
  readonly routes: readonly Route[];
  readonly group?: string;
  readonly overlaps?: readonly string[];
  /** Short tags: T028, ADV-12, INT-001. Expanded to WA-T028 etc. */
  readonly tests?: readonly string[];
  readonly gap: string;
  readonly triage?: 'ACCEPTED' | 'NEEDS_VALIDATION' | 'BLOCKED';
  readonly disposition?: 'OUT_OF_SCOPE_WITH_BOUNDARY' | 'BLOCKED_EXTERNAL_EVIDENCE';
}

const o = (title: string, routes: string, gap: string, extra: Partial<Overlay> = {}): Overlay => ({
  title,
  routes: routes.split('').map((c) => R[c]!),
  gap,
  ...extra,
});

export const OVERLAY: Record<string, Overlay> = {
  /* ---------------- R1 ---------------- */
  'WA-R1-01': o('One statutory deadline assumed for every WSIB decision', 'WP', 'Rule-source registry is empty by design; reviewer and rule content are Angelo/Domenic decisions (D-11).', { group: 'DEADLINE-HUMAN', overlaps: ['WA-R2-03', 'WA-R5-09'], tests: ['T028', 'T029', 'T030', 'T074', 'T075', 'ADV-12'] }),
  'WA-R1-02': o('Cross-tenant leak by object id, header or claim number', 'CS', 'Runtime RLS and tenant isolation on staging are unproven; this contract denies by construction but is not runtime evidence.', { group: 'TENANT-ISOLATION', overlaps: ['WA-R3-002', 'WA-R3-003', 'WA-R3-004', 'WA-R3-018'], tests: ['ADV-01', 'ADV-02', 'T019', 'T099'] }),
  'WA-R1-03': o('Professional or restricted documents visible to the wrong audience', 'WS', 'Publication rights and the lawful records-access channel need legal and privacy review (D-03, D-10); platform search, export and preview surfaces unproven.', { group: 'DISCLOSURE-SURFACES', overlaps: ['WA-R3-005', 'WA-R3-011', 'WA-R3-013', 'WA-R3-016'], tests: ['ADV-04', 'ADV-13', 'T023', 'T049', 'T051', 'T085'] }),
  'WA-R1-04': o('Sent or generated treated as received by WSIB', 'W', 'No persistence or UI. Accepted receipt methods need Domenic confirmation.', { group: 'RECEIPT-SEMANTICS', overlaps: ['WA-R4-04', 'WA-R5-08'], tests: ['T039', 'T040', 'T041', 'ADV-09'] }),
  'WA-R1-05': o('View grant mistaken for professional acceptance or authority', 'WC', 'Who formally accepts representation is an open WorkAid decision; the production schema has no acceptance record.', { group: 'AUTHORITY-SEPARATION', overlaps: ['WA-R3-007', 'WA-R3-009', 'WA-R4-09'], tests: ['T016', 'T017', 'T077', 'T083', 'T092'] }),
  'WA-R1-06': o('One worker, several claims and letters, mislinked ITOs', 'W', 'No schema or migration; ITO grouping within one claim is a professional choice (D-05).', { group: 'CLAIM-GRAPH', overlaps: ['WA-R2-02', 'WA-R4-01', 'WA-R4-02'], tests: ['T007', 'T008', 'T027', 'T073', 'ADV-06', 'ADV-07', 'ADV-08'] }),
  'WA-R1-07': o('Reminder dispatch fails or runs twice', 'WC', 'Durable outbox, real delivery sink and worker restart (T059) are not executed; platform worker is NO_GO.', { group: 'REMINDER-RELIABILITY', overlaps: ['WA-R4-05', 'WA-R4-06', 'WA-R4-12'], tests: ['T038', 'T045', 'T046', 'ADV-10'] }),
  'WA-R1-08': o('Intake succeeds although persistence or audit failed', 'C', 'Needs database and object-store failure injection (T057); not possible in the isolated harness.', {}),
  'WA-R1-09': o('Release or authorization form read as blanket medical access', 'WS', 'Per-purpose, recipient and data-class grant model is not in the production schema; legal review required.', { overlaps: ['WA-R3-009'], tests: ['T003', 'T005', 'T077', 'T092'] }),
  'WA-R1-10': o('Clio and Union Eyes both own the task (dual master)', 'WP', 'Task-of-record is deliberately UNRESOLVED pending Domenic (D-02). No connector exists.', { group: 'CLIO-ARCHITECTURE', overlaps: ['WA-R4-10', 'WA-R6-01', 'WA-R3-024'], tests: ['T054', 'T056', 'T096', 'ADV-15'] }),
  'WA-R1-11': o('Next-day rule creates a weekend or midnight deadline', 'WP', 'Business day versus calendar day (D-01) and the holiday calendar are unresolved; the rule is left unconfigured by design.', { group: 'DATE-RULES', overlaps: ['WA-R4-07'], tests: ['T042', 'T043'] }),
  'WA-R1-12': o('Document poisoning and sensitive data in telemetry', 'CW', 'No platform malware scan, AI/OCR deny or log-redaction canary run (T066 runtime, T093).', { group: 'UPLOAD-AND-LOGGING', overlaps: ['WA-R3-014', 'WA-R3-020', 'WA-R3-021'], tests: ['T010', 'T066', 'T098', 'ADV-19'] }),
  'WA-R1-13': o('Revoked or expired grant still works through a link or cache', 'WC', 'Platform revokeRepresentationAuthority has no grant or session cascade (source confirmed at 38a824918); sessions and links unproven at runtime.', { group: 'REVOCATION', overlaps: ['WA-R3-008', 'WA-R3-015', 'WA-R4-09'], tests: ['T018', 'T025', 'T047', 'T084', 'T100', 'ADV-03', 'ADV-05'] }),
  'WA-R1-14': o('Member sees a milestone that is only a draft', 'W', 'Stage vocabulary and plain-language text need Angelo approval (D-06).', { group: 'PUBLICATION', overlaps: ['WA-R3-011', 'WA-R4-08'], tests: ['T085', 'ADV-14'] }),
  'WA-R1-15': o('Aggregate dashboards expose small cohorts', 'WS', 'Cohort threshold is a policy decision; platform export paths unproven.', { overlaps: ['WA-R3-026'], tests: ['T052', 'T095'] }),
  'WA-R1-16': o('Intake gate blocks an urgent objection', 'WP', 'Which deficiencies may be waived (D-04) is unresolved; the test policy is synthetic and not a proposed default.', { group: 'URGENT-PATH', overlaps: ['WA-R2-04', 'WA-R4-03'], tests: ['T011', 'T016', 'T076', 'ADV-16'] }),
  'WA-R1-17': o('Deadline confirmation becomes a rubber stamp', 'W', 'Actor, source document, rule version and reasoning are enforced in the contract; the UI forcing function is unproven.', { tests: ['T028'] }),
  'WA-R1-18': o('Partner-reported figures presented as verified baselines', 'M', 'Measurement design only; no pilot cohort exists.', { group: 'CLAIMS-HONESTY', overlaps: ['WA-R2-09', 'WA-R6-03', 'WA-R6-05'] }),
  'WA-R1-19': o('Accessibility blocks distressed or disabled claimants', 'U', 'No UI exists; accessibility evidence requires built flows.', { overlaps: ['WA-R6-04', 'WA-R6-07'] }),
  'WA-R1-20': o('Compromised or replayed external connector', 'WS', 'No connector exists by design; only an event-admissibility contract is proven.', { group: 'CLIO-ARCHITECTURE', tests: ['T055'] }),
  'WA-R1-21': o('Identity collision links the wrong person or claim', 'WC', 'Identity binding and duplicate review workflow are unspecified; only claim-number conflict detection exists.', { overlaps: ['WA-R3-003'], tests: ['T015'] }),
  'WA-R1-22': o('Notifications and events carry clinical text', 'WC', 'Platform notification templates are free-form; a purpose-limited schema needs platform work.', { group: 'NOTIFICATION-CONTENT', overlaps: ['WA-R3-010', 'WA-R3-022', 'WA-R4-12'], tests: ['T053', 'T055', 'T091', 'ADV-14'] }),

  /* ---------------- R2 ---------------- */
  'WA-R2-01': o('Intake claim history copied into an ITO discloses another employer', 'WP', 'Which prior-claim numbers may appear on which form (D-12) is unresolved.', { group: 'CROSS-EMPLOYER', overlaps: ['WA-R4-01', 'WA-R5-02'], tests: ['T071', 'T072'] }),
  'WA-R2-02': o('One ITO per letter assumed; WSIB requires one per claim', 'WP', 'Grouping within one claim is a WorkAid professional choice (D-05).', { group: 'ITO-GROUPING', overlaps: ['WA-R1-06', 'WA-R4-02', 'WA-R5-01'], tests: ['T027', 'T073'] }),
  'WA-R2-03': o('Mixed-issue and exception-window deadlines treated uniformly', 'WP', 'Rule registry unpopulated; D-11.', { group: 'DEADLINE-HUMAN', overlaps: ['WA-R1-01', 'WA-R5-09'], tests: ['T028', 'T030', 'T074', 'T075'] }),
  'WA-R2-04': o('Waiting for evidence delays an urgent ITO', 'WP', 'D-04.', { group: 'URGENT-PATH', overlaps: ['WA-R1-16', 'WA-R4-03'], tests: ['T011', 'T076'] }),
  'WA-R2-05': o('WorkAid forms confused with the WSIB Direction of Authorization', 'W', 'Production schema has no typed instrument classes (WA-R3-009).', { group: 'AUTHORITY-SEPARATION', overlaps: ['WA-R3-009'], tests: ['T017', 'T077', 'T092'] }),
  'WA-R2-06': o('ARF treated as always available', 'WP', 'ARF readiness checklist content (WA-R5-04) needs Domenic; only an attested gate exists.', { overlaps: ['WA-R5-03', 'WA-R5-04'], tests: ['T078'] }),
  'WA-R2-07': o('WSIAT Notice of Appeal confused with the WSIB ARF', 'WP', 'No Tribunal appeal entity is implemented; NOA readiness is an attested boolean gate only (Angelo).', { group: 'TRIBUNAL', overlaps: ['WA-R5-05', 'WA-R5-06', 'WA-R5-07'], tests: ['T079'] }),
  'WA-R2-08': o('WSIAT confirmation stage ignored (and later renamed)', 'P', 'Angelo to confirm the current Hearing Ready Form / COA workflow. T080 not implemented.', { group: 'TRIBUNAL', overlaps: ['WA-R5-06'] }),
  'WA-R2-09': o('4-6 week wait presented as a legal clock', 'WM', 'No empirical baseline has been collected.', { overlaps: ['WA-R5-10', 'WA-R6-05'], tests: ['T031', 'T032'] }),

  /* ---------------- R3 ---------------- */
  'WA-R3-001': o('Org-scope CI detector skips double-quoted "use server"', 'C', 'Platform detector unchanged; reference detector and negative fixture handed to Codex.', { group: 'SERVER-ACTION-GOVERNANCE', tests: ['T081'] }),
  'WA-R3-002': o('Member-segment actions trust a caller-supplied organizationId', 'C', 'Mocked unit tests only; runtime isolation unproven.', { overlaps: ['WA-R1-02'] }),
  'WA-R3-003': o('External claim number never proven not to be an authorization key', 'WC', 'Platform read paths unproven; contract proves keys are internal ids and org scope.', { overlaps: ['WA-R1-02', 'WA-R1-21'], tests: ['T015', 'T099'] }),
  'WA-R3-004': o('Multi-organization specialist could blend tenants', 'CW', 'T089 not executed; active-membership selection is a platform concern.', { overlaps: ['WA-R1-02'] }),
  'WA-R3-005': o('Universal search matches titles before authorization', 'C', 'Platform route unchanged; reference ordering handed to Codex.', { group: 'SEARCH-AUTHZ', overlaps: ['WA-R3-013'], tests: ['T090'] }),
  'WA-R3-006': o('Pre-signed URLs issued for one year', 'C', 'Platform unchanged; one-year exposure itself unproven (unsafe intent confirmed).', { group: 'STORAGE', overlaps: ['WA-INT-002', 'WA-INT-003', 'WA-R1-13'], tests: ['T082'] }),
  'WA-R3-007': o('Demo handoff states are not production acceptance', 'W', 'Production schema has no acceptance record.', { group: 'AUTHORITY-SEPARATION', overlaps: ['WA-R1-05', 'WA-R4-09'], tests: ['T016', 'T083'] }),
  'WA-R3-008': o('Authority revocation does not cascade to grants', 'CW', 'Platform function unchanged (source confirmed); reference cascade proven synthetically.', { group: 'REVOCATION', overlaps: ['WA-R1-13', 'WA-R3-015', 'WA-R4-09'], tests: ['T084', 'ADV-03'] }),
  'WA-R3-009': o('Instrument classes (DOA, retainer, medical) not typed', 'WC', 'Production schema allows an untyped evidence document.', { group: 'AUTHORITY-SEPARATION', overlaps: ['WA-R2-05'], tests: ['T077', 'T092'] }),
  'WA-R3-010': o('Notification title and body are free-form', 'C', 'Platform templates unchanged.', { group: 'NOTIFICATION-CONTENT', overlaps: ['WA-R1-22', 'WA-R3-022'], tests: ['T053', 'T091'] }),
  'WA-R3-011': o('Member publication model is only proposed', 'W', 'Contract proven synthetically; no persistence, no UI.', { group: 'PUBLICATION', overlaps: ['WA-R1-03', 'WA-R1-14'], tests: ['T023', 'T049', 'T051', 'T085'] }),
  'WA-R3-012': o('Object metadata carries the human document name', 'C', 'Platform unchanged.', { group: 'STORAGE', overlaps: ['WA-INT-001'], tests: ['T097'] }),
  'WA-R3-013': o('Search scores filenames and widens steward visibility', 'C', 'Platform unchanged.', { group: 'SEARCH-AUTHZ', overlaps: ['WA-R3-005'], tests: ['T090'] }),
  'WA-R3-014': o('Logging and AI paths not proven free of medical content', 'C', 'Platform log scrub unproven.', { overlaps: ['WA-R1-12'], tests: ['T066'] }),
  'WA-R3-015': o('Revocation does not invalidate sessions', 'C', 'Identity runtime blocked; scoped invalidation requests specified only.', { group: 'REVOCATION', overlaps: ['WA-R3-008'], tests: ['T084'] }),
  'WA-R3-016': o('Hiding a title in the UI is not authorization', 'CW', 'Exports, thumbnails, caches, mobile unproven on the platform.', { overlaps: ['WA-R1-03'], tests: ['T100', 'ADV-04'] }),
  'WA-R3-017': o('Production readiness remains NO_GO', 'C', 'Codex owns staging qualification.', { group: 'PLATFORM-GATE', overlaps: ['WA-R3-025'] }),
  'WA-R3-018': o('Real Entra MFA and offboarding unproven', 'C', 'External authority required.', { overlaps: ['WA-R1-02'] }),
  'WA-R3-019': o('Server-action exceptions expire 2026-11-17 without migration', 'C', 'Platform ledger unchanged.', { group: 'SERVER-ACTION-GOVERNANCE', overlaps: ['WA-R3-001'], tests: ['T094'] }),
  'WA-R3-020': o('AI safety is regex-based and unproven on sensitive documents', 'C', 'T093 not executed; platform AI path unchanged.', { overlaps: ['WA-R1-12'] }),
  'WA-R3-021': o('Password-protected and polyglot uploads lack a quarantine path', 'CW', 'No platform malware scan run; contract assessment proven synthetically.', { overlaps: ['WA-R1-12'], tests: ['T010', 'T098'] }),
  'WA-R3-022': o('Notification templates accept arbitrary body text', 'C', 'Platform unchanged.', { group: 'NOTIFICATION-CONTENT', overlaps: ['WA-R1-22', 'WA-R3-010'], tests: ['T091'] }),
  'WA-R3-023': o('Grievance deadline resolver might be reused for WSIB obligations', 'WC', 'Resolver correctly fails loud today; separation proven by contract and a source tripwire.', { group: 'DEADLINE-REUSE', overlaps: ['WA-R4-06', 'WA-R4-11'], tests: ['T086'] }),
  'WA-R3-024': o('No Clio connector exists', 'W', 'Must remain true for any pilot candidate; boundary enforced by copy check.', { group: 'CLIO-ARCHITECTURE', overlaps: ['WA-R1-10', 'WA-R6-09'], tests: ['T054', 'T096'], disposition: 'OUT_OF_SCOPE_WITH_BOUNDARY' }),
  'WA-R3-025': o('UE production promotion restricted; staging probes in maintenance', 'C', 'Codex owns staging qualification.', { group: 'PLATFORM-GATE', overlaps: ['WA-R3-017'] }),
  'WA-R3-026': o('Cross-union aggregates lack small-cell suppression', 'WS', 'Threshold is a policy decision; platform exports unproven.', { overlaps: ['WA-R1-15'], tests: ['T052', 'T095'] }),

  /* ---------------- R4 ---------------- */
  'WA-R4-01': o('Multi-claim, multi-employer member flattened to one claim', 'WP', 'No schema; D-05 and D-12.', { group: 'CLAIM-GRAPH', overlaps: ['WA-R1-06', 'WA-R2-01', 'WA-R2-02', 'WA-R5-02'], tests: ['T007', 'T008', 'T071', 'T072', 'T073'] }),
  'WA-R4-02': o('ITO count derived from letter count', 'WP', 'D-05.', { group: 'ITO-GROUPING', overlaps: ['WA-R2-02', 'WA-R5-01'], tests: ['T027', 'T073', 'ADV-07', 'ADV-08'] }),
  'WA-R4-03': o('Missing authorization documents burn time on urgent appeals', 'WP', 'D-04.', { group: 'URGENT-PATH', overlaps: ['WA-R1-16', 'WA-R2-04', 'WA-R2-05'], tests: ['T011', 'T017', 'T076', 'T077'] }),
  'WA-R4-04': o('Generated-not-sent and sent-not-received', 'W', 'No persistence or UI.', { group: 'RECEIPT-SEMANTICS', overlaps: ['WA-R1-04', 'WA-R5-08'], tests: ['T039', 'T040', 'T041', 'ADV-09'] }),
  'WA-R4-05': o('Duplicate referral, submission or follow-up creation', 'W', 'Referral double-submit concurrency (T009) needs persistence.', { overlaps: ['WA-R1-07'], tests: ['T038', 'ADV-07'] }),
  'WA-R4-06': o('Reminders not delivered or double-processed; resolver reuse', 'WC', 'Real delivery sink unproven.', { group: 'REMINDER-RELIABILITY', overlaps: ['WA-R1-07', 'WA-R3-023'], tests: ['T038', 'T045', 'T046', 'ADV-10'] }),
  'WA-R4-07': o('Friday, weekend, holiday and DST edge cases', 'WP', 'D-01 unresolved.', { group: 'DATE-RULES', overlaps: ['WA-R1-11'], tests: ['T042', 'T043'] }),
  'WA-R4-08': o('Long ARO wait treated as a clock or published from a draft', 'W', 'ARO event attestation source needs Angelo.', { group: 'PUBLICATION', overlaps: ['WA-R1-14'], tests: ['T031', 'ADV-14'] }),
  'WA-R4-09': o('Representation change: WSIB DOA, engagement and grant are distinct', 'WC', 'Platform has no cascade (WA-R3-008).', { group: 'REVOCATION', overlaps: ['WA-R1-05', 'WA-R1-13', 'WA-R3-008'], tests: ['T017', 'T084'] }),
  'WA-R4-10': o('Clio and Union Eyes task conflict', 'WP', 'D-02.', { group: 'CLIO-ARCHITECTURE', overlaps: ['WA-R1-10'], tests: ['T056', 'ADV-15'] }),
  'WA-R4-11': o('Reusing the grievance deadline engine for WSIB', 'W', 'Separation enforced by contract and tripwire.', { group: 'DEADLINE-REUSE', overlaps: ['WA-R3-023'], tests: ['T086'] }),
  'WA-R4-12': o('Outbox poison and notification authorization', 'WC', 'Durable outbox unproven.', { group: 'NOTIFICATION-CONTENT', overlaps: ['WA-R1-22'], tests: ['T047', 'T053', 'T091'] }),

  /* ---------------- R5 ---------------- */
  'WA-R5-01': o('ITO grouping preference frozen as law', 'WP', 'D-05.', { group: 'ITO-GROUPING', overlaps: ['WA-R2-02', 'WA-R4-02'], tests: ['T027', 'T073'] }),
  'WA-R5-02': o('Cross-employer disclosure in ITO', 'WP', 'D-12.', { group: 'CROSS-EMPLOYER', overlaps: ['WA-R2-01'], tests: ['T071', 'T072'] }),
  'WA-R5-03': o('DOA, forms, WRF, ITO, ARF and NOA are different instruments', 'W', 'Typed submission kinds proven; stage content needs professional review.', { overlaps: ['WA-R2-05', 'WA-R2-06', 'WA-R2-07'], tests: ['T026', 'T077', 'T078', 'T079'] }),
  'WA-R5-04': o('ARF readiness criteria ignored', 'P', 'Checklist content is a professional decision; only an attested gate exists.', { overlaps: ['WA-R2-06'], tests: ['T078'] }),
  'WA-R5-05': o('ARO is not WSIAT; a final decision copy is required', 'P', 'No Tribunal assessment entity.', { group: 'TRIBUNAL', overlaps: ['WA-R2-07'], tests: ['T079'] }),
  'WA-R5-06': o('NOA, COA and Hearing Ready Form naming drift', 'P', 'Angelo must confirm current forms.', { group: 'TRIBUNAL', overlaps: ['WA-R2-08'] }),
  'WA-R5-07': o('Worker signature and disclosure obligations', 'P', 'Checklist items attested by humans; no entity yet.', { group: 'TRIBUNAL', overlaps: ['WA-R2-07'], tests: ['T079'] }),
  'WA-R5-08': o('Receipt definition confusion', 'W', 'Glossary in the product not yet written.', { group: 'RECEIPT-SEMANTICS', overlaps: ['WA-R1-04'], tests: ['T040'] }),
  'WA-R5-09': o('Exception windows applied universally', 'WP', 'Rule registry unpopulated.', { group: 'DEADLINE-HUMAN', overlaps: ['WA-R2-03'], tests: ['T030', 'T075'] }),
  'WA-R5-10': o('ARF has no submit deadline; waiting can become indefinite', 'WM', 'Dependency aging proven; SLA values are operational and unmeasured.', { overlaps: ['WA-R2-09'], tests: ['T031'] }),

  /* ---------------- R6 ---------------- */
  'WA-R6-01': o('Value is receipt ergonomics, not AI; dual queues raise load', 'MP', 'Time-motion study not designed in detail.', { group: 'CLIO-ARCHITECTURE', overlaps: ['WA-R1-10', 'WA-R4-10'] }),
  'WA-R6-02': o('WSIAT path needs supervisory gates', 'P', 'Angelo approvals undefined.', { group: 'TRIBUNAL' }),
  'WA-R6-03': o('Incomplete-referral rate unverified', 'M', 'No measured denominator.', { group: 'CLAIMS-HONESTY', overlaps: ['WA-R1-18'] }),
  'WA-R6-04': o('Member jargon, mobile, notification fatigue, exposure', 'U', 'No UI.', { overlaps: ['WA-R1-19'] }),
  'WA-R6-05': o('Economics claims from unverified baselines', 'M', 'No baseline.', { group: 'CLAIMS-HONESTY', overlaps: ['WA-R1-18', 'WA-R2-09'] }),
  'WA-R6-06': o('Kernel primitives versus WorkAid specialization config', 'W', 'Module boundary exists but an explicit kernel/specialization split is not yet enforced in code.', {}),
  'WA-R6-07': o('Mobile and assistive-technology failures', 'U', 'No UI.', { overlaps: ['WA-R1-19'] }),
  'WA-R6-08': o('Notification fatigue', 'U', 'No UI; priority tiers unspecified.', {}),
  'WA-R6-09': o('Forbidden theatre: "Clio integrated", "pilot ready", composite scores', 'W', 'Copy check proven; commercial material not reviewed.', { group: 'CLIO-ARCHITECTURE', overlaps: ['WA-R3-024'], tests: ['T096'] }),

  /* ---------------- Intake hypotheses ---------------- */
  'WA-INT-001': o('Blob key embeds document name; name logged', 'C', 'Platform unchanged; canary reproduction handed to Codex.', { group: 'STORAGE', overlaps: ['WA-R3-012'], tests: ['INT-001', 'T097'] }),
  'WA-INT-002': o('Azure branch claims SAS but returns an unsigned URL', 'C', 'Container ACL and real access behaviour unproven.', { group: 'STORAGE', overlaps: ['WA-R3-006'], tests: ['INT-002'] }),
  'WA-INT-003': o('Put-then-sign leaves an orphan when signing fails', 'C', 'Platform unchanged.', { group: 'STORAGE', overlaps: ['WA-R3-006'], tests: ['INT-003'] }),
  /* ---------------- Slice C (self-identified; ids are new, nothing renumbered) ---------------- */
  'WA-C-001': o('Receipt confirmation treated as a filed submission', 'WP', 'Requirement sources are an empty registry; who may determine valid filing and whether receipt is a prerequisite (F-01) are Angelo decisions (D-19). Receipt is still not persisted or surfaced in any UI.', { group: 'RECEIPT-SEMANTICS', overlaps: ['WA-R1-04', 'WA-R4-04', 'WA-R5-08'], tests: ['T102', 'T103', 'T104', 'T105', 'T106', 'T107', 'T108'] }),
  'WA-C-002': o('Preparation tooling could write into another checkout', 'W', 'The guard governs this harness only. The typecheck still reads TypeScript from another checkout read-only; a future clean install in this worktree would remove that.', { tests: ['T109', 'T110'] }),
  'WA-C-003': o('Status wording can misrepresent procedural progress', 'WPU', 'The lint is a backstop over fixed patterns, not a proof of meaning; the approved plain-language and French wording is a content decision (D-20) and no translation or accessibility testing has run.', { group: 'CLAIMS-HONESTY', overlaps: ['WA-R2-09'], tests: ['T111', 'T112', 'T113'] }),
};

export interface AdversarialCase {
  readonly id: string;
  readonly n: number;
  readonly title: string;
  readonly requirements: readonly string[];
  readonly threat: string;
  readonly preconditions: string;
  readonly inputs: string;
  readonly expected: string;
  readonly gap: string;
}

export const ADVERSARIAL_CASES: readonly AdversarialCase[] = [
  { id: 'WA-ADV-01', n: 1, title: "A union user requests another union's referral", requirements: ['WA-T020', 'WA-R1-02'], threat: 'Cross-tenant referral access', preconditions: 'Referral belongs to Union A; actor is a Union B referral rep with an active session', inputs: 'UPDATE_PACKET and view by the Union B principal', expected: 'Non-disclosing NOT_FOUND; no state change', gap: 'Search, export, aggregates and runtime RLS unproven (WA-T020, WA-T068)' },
  { id: 'WA-ADV-02', n: 2, title: 'A specialist accesses an unassigned matter', requirements: ['WA-R1-02', 'WA-R3-004'], threat: 'Horizontal access inside the specialist organization', preconditions: 'Specialist in the right organization with a grant but not assigned', inputs: 'Matter access VIEW', expected: 'NOT_FOUND', gap: 'Multi-org session switching (WA-T089) not executed' },
  { id: 'WA-ADV-03', n: 3, title: 'A revoked representative retries an old document link', requirements: ['WA-T018', 'WA-T084', 'WA-R1-13'], threat: 'Stale link after revocation', preconditions: 'Link issued while the grant was live; grant later revoked', inputs: 'Link redemption; authority cascade revoke', expected: 'Denied; dependent grants revoked; epoch advanced', gap: 'Platform revocation has no cascade (WA-R3-008); prior downloads irrevocable' },
  { id: 'WA-ADV-04', n: 4, title: 'A member guesses a restricted medical document id', requirements: ['WA-T019', 'WA-R1-03'], threat: 'Identifier guessing', preconditions: 'Member of the same matter without a release grant', inputs: 'Document VIEW by id', expected: 'NOT_FOUND with no title or class', gap: 'Platform blob and search paths unproven' },
  { id: 'WA-ADV-05', n: 5, title: 'An expired grant remains cached', requirements: ['WA-T025', 'WA-R1-13'], threat: 'Stale authorization cache', preconditions: 'Allow cached while the grant was live', inputs: 'Cache validity at expiry, newer revocation epoch, over-age and an inflated max-age', expected: 'Entry unusable in all four cases', gap: 'No real cache exists to test' },
  { id: 'WA-ADV-06', n: 6, title: 'A client has multiple claims and an objection is attached to the wrong claim', requirements: ['WA-T008', 'WA-R1-06'], threat: 'Wrong-claim linkage', preconditions: 'Two claims, five decisions', inputs: 'createObjection with the other claim id', expected: 'WRONG_CLAIM', gap: 'No persistence layer' },
  { id: 'WA-ADV-07', n: 7, title: 'The same denial is submitted twice', requirements: ['WA-T009', 'WA-R4-05'], threat: 'Duplicate decision and objection', preconditions: 'Letter already recorded', inputs: 'Same letter hash again; same objection request id again', expected: 'Single decision and single objection; changed payload under same key rejected', gap: 'Concurrent referral submit (WA-T009) needs persistence' },
  { id: 'WA-ADV-08', n: 8, title: 'A new objection is incorrectly deduplicated against a legitimate older one', requirements: ['WA-R4-02'], threat: 'Over-eager deduplication hiding a real objection', preconditions: 'Older objection withdrawn, or covering a different issue', inputs: 'New objection with a new request id', expected: 'Created with its own sequence; overlapping active objection needs a human', gap: 'Human resolution workflow not specified' },
  { id: 'WA-ADV-09', n: 9, title: 'A dispatch succeeds but WSIB receipt is never confirmed', requirements: ['WA-T040', 'WA-R1-04'], threat: 'False assurance of receipt', preconditions: 'Dispatched and provider-acknowledged submission', inputs: 'State inspection; forbidden jumps', expected: 'Stays receipt-unconfirmed; never counts as filed', gap: 'Escalation timing after silence needs Domenic rule' },
  { id: 'WA-ADV-10', n: 10, title: 'A receipt-confirmation reminder fires twice', requirements: ['WA-T038', 'WA-R1-07'], threat: 'Duplicate notification', preconditions: 'Scheduled reminder; two workers race', inputs: 'Lease claim, delivery outcome, late duplicate outcome', expected: 'One lease, one delivery; later outcomes cannot regress state', gap: 'Real worker and sink not executed' },
  { id: 'WA-ADV-11', n: 11, title: 'A task is reassigned while its reminder is queued', requirements: ['WA-T048'], threat: 'Reminder sent to former assignee', preconditions: 'Reminder scheduled for owner epoch 1', inputs: 'Reassignment by principal; delivery decision', expected: 'Old reminder cancelled; delivery refuses a stale snapshot; new epoch scheduled', gap: 'Platform snapshot/convergence behaviour unproven for WSIB' },
  { id: 'WA-ADV-12', n: 12, title: 'A user changes time zones near a statutory deadline', requirements: ['WA-T036', 'WA-R1-11'], threat: 'Wrong expiry from viewer time zone', preconditions: 'Human-confirmed date; DST ends that day in the matter zone', inputs: 'Status one second before and at expiry; viewer zone not an input', expected: 'Expiry at local midnight in the matter zone', gap: 'Legal time-of-day rule for filing needs professional confirmation' },
  { id: 'WA-ADV-13', n: 13, title: 'A professional notes that a document must remain restricted', requirements: ['WA-R1-03'], threat: 'Release despite a hold', preconditions: 'Hold placed by a WorkAid professional', inputs: 'Release to member and union; lift attempts', expected: 'Release denied until a principal lifts with a reason', gap: 'Who may lift is an open decision (D-03)' },
  { id: 'WA-ADV-14', n: 14, title: 'An unapproved notification exposes a restricted document title', requirements: ['WA-T053', 'WA-T091'], threat: 'Title leakage through notification', preconditions: 'Restricted document with a canary title', inputs: 'buildNotification with and without preview', expected: 'Generic text only; preview discarded for sensitive classes and for titles', gap: 'Platform notification schema is free-form (WA-R3-010)' },
  { id: 'WA-ADV-15', n: 15, title: 'Clio and Union Eyes contain conflicting task states', requirements: ['WA-T056', 'WA-R1-10'], threat: 'Dual master', preconditions: 'Same submission tracked in both systems', inputs: 'Reconcile under each task-of-record value', expected: 'Reconciliation exception; no writeback; external done is not receipt', gap: 'Task-of-record unresolved (D-02)' },
  { id: 'WA-ADV-16', n: 16, title: 'A referral is returned for correction while an urgent professional review remains pending', requirements: ['WA-T011', 'WA-R1-16'], threat: 'Urgent review lost on return', preconditions: 'Referral offered under an urgent exception', inputs: 'RETURN, WITHDRAW, DECLINE', expected: 'Review stays pending; withdraw and decline blocked until dispositioned', gap: 'Who disposes of an urgent review (D-04)' },
  { id: 'WA-ADV-17', n: 17, title: "A worker's authorization expires during an active matter", requirements: ['WA-T017'], threat: 'Continued action on expired authority', preconditions: 'DOA with an expiry one minute away', inputs: 'Professional action before and at expiry', expected: 'Allowed before; denied from the instant of expiry', gap: 'Renewal workflow not specified' },
  { id: 'WA-ADV-18', n: 18, title: 'A matter closes while a scheduled reminder remains outstanding', requirements: ['WA-T047'], threat: 'Notifications after closure', preconditions: 'Open task and scheduled reminder', inputs: 'Matter closure; delivery decision', expected: 'Tasks and reminders cancelled; delivery refuses a closed matter', gap: 'Reopen semantics not specified' },
  { id: 'WA-ADV-19', n: 19, title: 'A malicious attachment carries misleading metadata or instructions', requirements: ['WA-T058', 'WA-T098'], threat: 'Metadata or content treated as instruction or classification', preconditions: 'Filename with instruction-like text and a spoofed class and extension', inputs: 'assessUpload', expected: 'Quarantined, unverified, class claim ignored, name neutralized', gap: 'No malware scan or content parsing in the harness; platform ClamAV unproven' },
  { id: 'WA-ADV-20', n: 20, title: 'A purported professional approval is forged through an API request', requirements: ['WA-R1-17'], threat: 'Forged approval', preconditions: 'Approval request carries an asserted approver', inputs: 'Mismatched claim, union principal, inactive session, system actor', expected: 'Refused with APPROVER_MISMATCH, NOT_PROFESSIONAL, HUMAN_ACTOR_REQUIRED', gap: 'Real authentication and session binding are platform responsibilities' },
];
