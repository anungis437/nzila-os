/**
 * Revised requirements baseline (v0.2). Each requirement is traced to its
 * source, the harness module that implements the contract, the acceptance
 * matrix cases that exercise it, the findings it answers and the open
 * professional decisions it depends on. `status` is derived by the builder from
 * test results; it is never written here.
 */
export interface Requirement {
  readonly id: string;
  readonly area: string;
  readonly text: string;
  readonly source: string;
  readonly module: string;
  readonly matrix: readonly string[];
  readonly findings: readonly string[];
  readonly decisions: readonly string[];
}

const q = (id: string, area: string, text: string, source: string, module: string, matrix: string, findings: string, decisions = ''): Requirement => ({
  id,
  area,
  text,
  source,
  module,
  matrix: matrix ? matrix.split(' ') : [],
  findings: findings ? findings.split(' ') : [],
  decisions: decisions ? decisions.split(' ') : [],
});

export const REQUIREMENTS: readonly Requirement[] = [
  /* Referral and intake */
  q('WA-REQ-001', 'INTAKE', 'A referral packet is evaluated server-side from its contents; a client-supplied completeness flag has no effect.', 'Mission §4; WA-T002', 'referral.ts', 'WA-T002', 'WA-R1-09'),
  q('WA-REQ-002', 'INTAKE', 'Each required form (client intake, medical authorization, retainer, share-information release) and government photo ID is reported individually with a next-action owner.', 'Mission §4; Domenic 21 Oct', 'referral.ts', 'WA-T001 WA-T003 WA-T004 WA-T005 WA-T006', 'WA-R1-09'),
  q('WA-REQ-003', 'INTAKE', 'Current and historical claim numbers must be declared; every denial decision requiring review needs its letter; WSIB correspondence is provided or declared absent.', 'Mission §4', 'referral.ts', '', 'WA-R4-01'),
  q('WA-REQ-004', 'INTAKE', 'A document-complete packet never asserts professional or legal sufficiency (`professionalSufficiency` is always NOT_ASSESSED).', 'Mission §4', 'referral.ts', 'WA-T001 WA-T013', 'WA-R1-16'),
  q('WA-REQ-005', 'INTAKE', 'Unreadable, unsigned, wrong-claim and duplicate items do not count as provided.', 'WA-T010', 'referral.ts', 'WA-T010', 'WA-R3-021'),
  q('WA-REQ-006', 'INTAKE', 'An urgent exception routes an incomplete packet to expedited professional review without making the checklist complete; it needs an authorized WorkAid role, a reason, an urgency basis and only policy-waivable items.', 'WA-R1-16; WA-R2-04', 'referral.ts', 'WA-T011 WA-T016 WA-T076', 'WA-R1-16 WA-R2-04 WA-R4-03', 'D-04'),
  q('WA-REQ-007', 'INTAKE', 'Referral lifecycle supports clarification, return for correction, acceptance, decline and withdrawal; return never cancels a pending urgent review; prior evidence is never erased.', 'Mission §7 Slice B', 'referral.ts', 'WA-T012 WA-T013', 'WA-R1-16', 'D-04'),
  q('WA-REQ-008', 'INTAKE', 'Professional acceptance is a separate act from the checklist and from any access grant, reserved to roles named by an explicit policy.', 'WA-R1-05', 'referral.ts', 'WA-T013', 'WA-R1-05 WA-R3-007', 'D-13'),
  /* Authority and access */
  q('WA-REQ-010', 'AUTHORITY', 'Technical matter access, professional acceptance and a live WSIB Direction of Authorization are three separate facts; WSIB representative action requires all three.', 'Grok requirements delta CORRECT-5', 'authorization.ts', 'WA-T016 WA-T017 WA-T077 WA-T083 WA-T092', 'WA-R1-05 WA-R3-007 WA-R3-009 WA-R2-05'),
  q('WA-REQ-011', 'AUTHORITY', 'The four WorkAid intake instruments never substitute for a WSIB DOA.', 'WA-R2-05', 'authorization.ts', 'WA-T077 WA-T092', 'WA-R2-05 WA-R3-009'),
  q('WA-REQ-012', 'AUTHORITY', 'An authorization that expires stops authorizing at the instant of expiry; revoked, expired, mismatched-user and inactive-session grants are refused.', 'WA-R1-13', 'authorization.ts', 'WA-T017', 'WA-R1-13'),
  q('WA-REQ-013', 'AUTHORITY', 'Every unauthorized cross-organization or unassigned access returns a non-disclosing NOT_FOUND.', 'WA-R1-02', 'authorization.ts referral.ts', 'WA-T019', 'WA-R1-02 WA-R3-004'),
  q('WA-REQ-014', 'AUTHORITY', 'Claim numbers are data, never authorization keys; only internal ids and organization scope relate or authorize records.', 'WA-T015 WA-T099', 'claims.ts authorization.ts', 'WA-T015 WA-T099', 'WA-R3-003 WA-R1-21'),
  q('WA-REQ-015', 'AUTHORITY', 'Revoking an authorization instrument revokes its dependent grants atomically, bumps a revocation epoch, cancels the affected user’s reminders, requests only scoped session invalidation, and returns undispatched approvals for re-review. Revoking a WSIB DOA does not revoke technical grants.', 'Grok requirements delta ADD-2', 'revocation.ts', 'WA-T084', 'WA-R3-008 WA-R3-015 WA-R4-09'),
  q('WA-REQ-016', 'AUTHORITY', 'Cached allow decisions live at most 60 seconds and are void on expiry or a newer revocation epoch.', 'WA-R1-13', 'authorization.ts', 'WA-ADV-05', 'WA-R1-13'),
  /* Claim graph */
  q('WA-REQ-020', 'CLAIMS', 'A member has many claims; a claim has many decisions; a decision has many disputed issues; an objection belongs to one claim and one decision and covers a subset of its issues.', 'WA-R1-06; WA-R2-02', 'claims.ts', 'WA-T007 WA-T008 WA-T027', 'WA-R1-06 WA-R2-02 WA-R4-01'),
  q('WA-REQ-021', 'CLAIMS', 'The same letter submitted twice resolves to one decision; the same letter under a different claim is held for review; a claim number linked to another member is never auto-joined.', 'WA-ADV-07', 'claims.ts', 'WA-ADV-07', 'WA-R1-06 WA-R1-21'),
  q('WA-REQ-022', 'CLAIMS', 'Objection creation is idempotent per request id; an active objection overlapping an issue requires a human; a legitimate re-objection after withdrawal is created, not deduplicated.', 'WA-ADV-08', 'claims.ts', 'WA-ADV-08', 'WA-R4-02'),
  q('WA-REQ-023', 'CLAIMS', 'ITO grouping within a claim is a professional strategy with no default; groups never span claims; the ITO count is never derived from the letter count.', 'WA-R2-02', 'claims.ts', 'WA-T027 WA-T073', 'WA-R2-02 WA-R4-02 WA-R5-01', 'D-05'),
  q('WA-REQ-024', 'CLAIMS', 'Claim numbers from another employer, or an unknown employer, are excluded from outbound submissions; same-employer references need a professional work-context validation.', 'WA-R2-01', 'claims.ts', 'WA-T071 WA-T072', 'WA-R2-01 WA-R5-02', 'D-12'),
  /* Submissions */
  q('WA-REQ-030', 'SUBMISSION', 'DOA, WRF, ITO, ARF, written submission and WSIAT NOA are distinct typed submissions; ITO/ARF link claim, decision, objection and issues.', 'WA-T026 WA-T027', 'submission.ts', 'WA-T026 WA-T027', 'WA-R5-03'),
  q('WA-REQ-031', 'SUBMISSION', 'The submission state machine permits only listed transitions; every other (from, to) pair is refused.', 'WA-R4-04', 'submission.ts', 'WA-T039 WA-T040', 'WA-R1-04 WA-R4-04'),
  q('WA-REQ-032', 'SUBMISSION', 'Provider acknowledgement is system-only and never confirms receipt; WSIB receipt is confirmed only by an authorized human with a recognized method and a contact or evidence reference.', 'WA-R1-04', 'submission.ts', 'WA-T040 WA-T041', 'WA-R1-04 WA-R5-08', 'D-14'),
  q('WA-REQ-033', 'SUBMISSION', 'Approval requires an authenticated professional whose identity equals the asserted approver, a professional authorization, and (configurably) a different person from the preparer; an ARF or NOA also needs an attested readiness gate.', 'WA-R1-17', 'submission.ts', 'WA-T078 WA-T079', 'WA-R2-06 WA-R2-07', 'D-15'),
  q('WA-REQ-034', 'SUBMISSION', 'Dispatch is idempotent per request id; a second send under a new id is refused; representative documents need live WSIB authority.', 'WA-T038', 'submission.ts', 'WA-T017', 'WA-R4-05'),
  /* Tasks and reminders */
  q('WA-REQ-040', 'TASKS', 'A dispatched submission version yields exactly one receipt follow-up task; drafts, reviews and approvals yield none; replays and races resolve to the same task.', 'WA-T037 WA-T038 WA-T039', 'followup.ts', 'WA-T037 WA-T038 WA-T039', 'WA-R1-07 WA-R4-05'),
  q('WA-REQ-041', 'TASKS', 'Task-of-record is UNRESOLVED until Domenic decides: an unresolved task is non-authoritative and schedules no reminders; if Clio is the record Union Eyes generates no task.', 'WA-R1-10', 'followup.ts', 'WA-ADV-15', 'WA-R1-10 WA-R4-10', 'D-02'),
  q('WA-REQ-042', 'TASKS', 'Due dates are computed from local calendar dates in the matter zone only when a rule is configured; otherwise the owner confirms. Weekend landings are surfaced, never silently shifted.', 'WA-R1-11', 'followup.ts time.ts', 'WA-T042 WA-T043', 'WA-R1-11 WA-R4-07', 'D-01'),
  q('WA-REQ-043', 'TASKS', 'Snooze needs a reason and preserves the original due date; overdue is judged on the original date; a task completes only from a confirmed receipt of its own submission version; failures are escalated, not erased.', 'WA-T044', 'followup.ts', 'WA-T041 WA-T044', 'WA-R1-07'),
  q('WA-REQ-044', 'TASKS', 'Reminders are idempotent per (task, owner epoch, offset), snapshot their recipient, are re-validated at delivery, hold a worker lease, record observed outcomes and dead-letter visibly.', 'Grok R4 reusable contract', 'followup.ts', 'WA-T038 WA-T045 WA-T046 WA-T047 WA-T048 WA-T100', 'WA-R1-07 WA-R4-06'),
  q('WA-REQ-045', 'TASKS', 'Reassignment is a principal act, preserves provenance, supersedes the previous owner’s reminders; closing a matter cancels its tasks and reminders.', 'WA-T048', 'followup.ts', 'WA-T048', 'WA-R4-06'),
  q('WA-REQ-046', 'TASKS', 'The WorkAid contracts do not import or reuse the grievance deadline engine, its resolver, scheduler or tables.', 'WA-R3-023', 'followup.ts deadlines.ts', 'WA-T086', 'WA-R3-023 WA-R4-11'),
  /* Deadlines and dependencies */
  q('WA-REQ-050', 'DEADLINES', 'The system never computes a statutory deadline or declares one met; a professional confirms a date with source document, rule source, reasoning and (for mixed issues or exception windows) explicit manual affirmation. Confirmations are append-only.', 'WA-R1-01 WA-R2-03', 'deadlines.ts', 'WA-T028 WA-T029 WA-T030 WA-T074 WA-T075', 'WA-R1-01 WA-R2-03 WA-R5-09', 'D-11'),
  q('WA-REQ-051', 'DEADLINES', 'A confirmed date ends at local midnight in the matter zone regardless of the viewer’s zone.', 'WA-R1-11', 'deadlines.ts', 'WA-ADV-12', 'WA-R1-11', 'D-01'),
  q('WA-REQ-052', 'DEADLINES', 'A disposition requires a receipt-confirmed submission and a professional, and still does not assert timeliness.', 'WA-R1-17', 'deadlines.ts', '', 'WA-R1-17'),
  q('WA-REQ-053', 'DEADLINES', 'External dependencies have an owner; an observed wait (for example 4–6 weeks) is an operational prompt with legalDeadline=false; batches received do not mark a file complete.', 'WA-R2-09', 'dependency.ts', 'WA-T031 WA-T032', 'WA-R2-09 WA-R5-10'),
  /* Disclosure */
  q('WA-REQ-060', 'DISCLOSURE', 'Documents default to quarantine; classification is set only by an authorized human, never by upload metadata or content.', 'WA-R1-12', 'upload.ts', 'WA-T010 WA-T098', 'WA-R1-12 WA-R3-021'),
  q('WA-REQ-061', 'DISCLOSURE', 'Restricted, medical, identity and quarantined classes are never disclosed to a union audience; member access needs an active member grant and no professional hold.', 'Spec §7', 'authorization.ts', 'WA-T023', 'WA-R1-03'),
  q('WA-REQ-062', 'DISCLOSURE', 'A professional restriction hold blocks release to member and union; lifting needs a role named by policy and a reason.', 'WA-ADV-13', 'authorization.ts', 'WA-ADV-13', 'WA-R1-03', 'D-03'),
  q('WA-REQ-063', 'DISCLOSURE', 'Member publication is deny-by-default: nothing is shown unless a professional publishes versioned text backed by evidence matching the stage; drafts never create milestones; a lawful records-access channel is always shown.', 'WA-R1-14', 'publication.ts', 'WA-T049 WA-T051 WA-T085', 'WA-R1-14 WA-R3-011 WA-R4-08', 'D-06'),
  q('WA-REQ-064', 'DISCLOSURE', 'Notifications are purpose-limited: generic text, opaque deep link that re-authorizes, no title or health content; previews are discarded for sensitive classes.', 'WA-R1-22', 'authorization.ts', 'WA-T053 WA-T091', 'WA-R1-22 WA-R3-010'),
  q('WA-REQ-065', 'DISCLOSURE', 'Audit events carry allow-listed short codes and opaque ids only.', 'WA-T066', 'audit.ts', 'WA-T066', 'WA-R1-12 WA-R3-014'),
  q('WA-REQ-066', 'DISCLOSURE', 'Cohorts below a policy threshold are suppressed, with complementary suppression.', 'WA-R1-15', 'authorization.ts', 'WA-T052 WA-T095', 'WA-R1-15 WA-R3-026'),
  /* Architecture */
  q('WA-REQ-070', 'ARCHITECTURE', 'Option B (split responsibility) is provisional: Clio is the professional file of record; no connector and no automatic writeback; no copy may claim a Clio integration.', 'Triage decision', 'clio.ts', 'WA-T054 WA-T096', 'WA-R3-024 WA-R6-09', 'D-07'),
  q('WA-REQ-071', 'ARCHITECTURE', 'Conflicting task states raise a reconciliation exception with no writeback; an external "done" is not receipt evidence.', 'WA-R1-10', 'clio.ts', 'WA-T056 WA-ADV-15', 'WA-R1-10 WA-R4-10', 'D-02'),
  q('WA-REQ-072', 'ARCHITECTURE', 'A future integration event is admitted only once, for its own tenant, by allow-listed type and field, within an age limit.', 'WA-R1-20', 'clio.ts', 'WA-T055', 'WA-R1-20'),
  /* Platform (routed, not implemented here) */
  q('WA-REQ-080', 'PLATFORM', 'Org-scope CI detectors must recognize both quote styles of `use server`; exceptions fail CI when expired.', 'WA-R3-001 WA-R3-019', 'platform-repro/server-action-detector.ts', 'WA-T081 WA-T094', 'WA-R3-001 WA-R3-019'),
  q('WA-REQ-081', 'PLATFORM', 'Download URLs are minted only after fresh authorization with a TTL ≤ 60 minutes; storage keys and metadata are opaque; an upload failing after storage compensates; no bare URL is presented as signed.', 'WA-R3-006 WA-R3-012 WA-INT-001..003', 'platform-repro/storage-policy.ts', 'WA-T082 WA-T097', 'WA-R3-006 WA-R3-012 WA-INT-001 WA-INT-002 WA-INT-003'),
  q('WA-REQ-082', 'PLATFORM', 'Search authorizes before matching titles.', 'WA-R3-005', 'platform-repro/search-authorization.ts', 'WA-T090', 'WA-R3-005 WA-R3-013'),
  q('WA-REQ-083', 'PLATFORM', 'Authority revocation cascades to grants and scoped sessions.', 'WA-R3-008', 'revocation.ts', 'WA-T084', 'WA-R3-008 WA-R3-015'),
  /* Tribunal */
  q('WA-REQ-090', 'TRIBUNAL', 'A WSIAT NOA is a distinct submission kind that cannot be approved without an attested readiness gate (final WSIB decision attached, worker signature/disclosure reviewed); later tribunal steps are tracked separately and never marked complete at NOA; nothing is auto-filed.', 'WA-R2-07 WA-R2-08', 'submission.ts', 'WA-T079', 'WA-R2-07 WA-R2-08 WA-R5-05 WA-R5-06 WA-R5-07', 'D-06'),
  q('WA-REQ-091', 'TRIBUNAL', 'An adverse, partial or unknown ARO outcome opens a prompt for a professional assessment of whether to proceed; the system records only the professional decision, states no time limit and never prepares a tribunal submission without an assessed-proceed record.', 'Slice C §3 Journey B', 'tribunal.ts', 'WA-T114', 'WA-R2-07', 'D-23'),
  q('WA-REQ-100', 'FILING', 'Dispatch, receipt acknowledgement, a professional determination of valid filing and the authority\'s own acceptance or rejection are distinct facts with distinct evidence and authority. A receipt record never implies valid filing; a malformed, incomplete, unauthorized or misdirected submission cannot become validly filed; timeliness is never asserted.', 'Slice C §2 WA-C-001', 'filing.ts submission.ts', 'WA-T102 WA-T103 WA-T104 WA-T105 WA-T106 WA-T107 WA-T108', 'WA-C-001 WA-R1-04 WA-R4-04 WA-R5-08', 'D-19'),
  q('WA-REQ-110', 'IDENTITY', 'Duplicate worker identities and duplicate union relationships are resolved by an explicit authorized action; until then no record is merged and no access is widened.', 'Slice C §4', 'journey.ts', 'WA-T115', 'WA-R1-06', 'D-21'),
  q('WA-REQ-111', 'PUBLICATION', 'Member- and union-facing wording must not claim receipt, filing, validity or acceptance that the evidence does not support; a decision notice says a decision arrived and never states the outcome.', 'Slice C §4', 'publication.ts', 'WA-T111', 'WA-C-003 WA-R2-09', 'D-20'),
  q('WA-REQ-112', 'PUBLICATION', 'French and English content are separate contracts: French is shown only if provided and recorded as unreviewed, English fallback is labelled, and where policy requires French an English-only publication is refused. No translation quality or accessibility is claimed.', 'Slice C §3 Journey D', 'publication.ts', 'WA-T112 WA-T113', 'WA-C-003', 'D-20'),
  q('WA-REQ-120', 'ISOLATION', 'Preparation operations may write only under the two preparation prefixes or OS temp, never into another worktree, and validation runs in a temp sandbox.', 'Slice C §2 WA-C-002', 'scripts/guard.ts', 'WA-T109 WA-T110', 'WA-C-002', ''),
];
