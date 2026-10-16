# CIVIC - Round 1 Controlled Human Validation Authorization

**Human maintainer / facilitator / proof and data custodian:** Aubert Nungisa

**Human decision date:** 2026-10-12

**Authorization:** `CIVIC_HUMAN_VALIDATION_ROUND_1 = AUTHORIZED_WITH_CONDITIONS`

**Effective:** `2026-10-12T23:59:13.9553409+00:00`

**Expires:** `2026-11-11T23:59:13.9553409+00:00`

**Maximum participant sessions:** `6`

**Data boundary:** `SYNTHETIC_SCENARIO_ONLY`

**Findings / results:** NONE; D_GATE, R_GATE and T_GATE remain UNSCORED.

This records the already-approved human-maintainer decision and subsequent evidence
governance amendment. The original exact host capture is preserved; recording this
document does not restart the 30-day window. No automatic renewal.
The authorization is for controlled human research, not application runtime.

## 1. Canonical bounded authorization

The validator compares the single machine-readable block below with the exact
human-approved grant. Altered dates, session count, location, recording, retention
or custody fail closed. Revocation stops admission; a new grant needs an explicit
human decision and scoped governance update, not an edit to this record.

```json
{
  "status": "AUTHORIZED_WITH_CONDITIONS",
  "effectiveAt": "2026-10-12T23:59:13.9553409+00:00",
  "expiresAt": "2026-11-11T23:59:13.9553409+00:00",
  "maximumSessions": 6,
  "facilitator": "Aubert Nungisa",
  "custodian": "Aubert Nungisa",
  "accessModel": "CUSTODIAN_ONLY",
  "evidenceDirectory": "C:\\APPS\\nzila-os.worktrees\\pasted-text-processing\\.civic-research\\round1",
  "classification": "CONTROLLED_HUMAN_VALIDATION_RESEARCH_EVIDENCE",
  "scenarioBoundary": "SYNTHETIC_SCENARIO_ONLY",
  "recordingDefault": "NO_AUDIO_VIDEO_RECORDING",
  "retention": "90_DAYS_AFTER_ROUND_1_CLOSEOUT",
  "retentionReview": "HUMAN_ACTION_REQUIRED",
  "withdrawal": "STOP_USE_DELETE_OR_ISOLATE_BEFORE_FINAL_SYNTHESIS",
  "runtimeAuthorized": false,
  "productionAuthorized": false,
  "realInstitutionalDataAuthorized": false,
  "automaticRenewal": false,
  "outboundMessagesAutonomous": false,
  "participantSetRequiresMaintainerApproval": true,
  "revokedAt": null
}
```

## 2. Allowed activities and the sending boundary

Subject to activation PASS and the finite window: prepare candidate participants,
invitation drafts and scheduling options; deliver approved static materials;
Aubert facilitates at most six consented sessions; capture minimum evidence;
synthesize findings and assess D_GATE/R_GATE/T_GATE. No outcome is presumed.

This mission stops at the activation recheck. After PASS,
`OUTREACH_PREPARATION_AUTHORIZED` permits drafting and selection preparation only.
Present actual people and contact channels to Aubert before any outreach.
No autonomous messages. Sending requires a separate explicit instruction.
Scheduling and outreach in principle do not substitute for that final control.
No participants, invitations, findings or scheduled sessions exist at activation.

Sequence: two operational/Daphne-oriented sessions first, two institutional/
Richard-oriented second, two executive/Tom-oriented third. Codes are identifiers,
not created participant records:
`R1-D-01`, `R1-D-02`, `R1-R-01`, `R1-R-02`, `R1-T-01`, `R1-T-02`.
One person can exercise several lenses, but every session still counts toward six
and observations are attributed to the actual lens. No uncounted repeat sessions.
If a session stops early, retain its status and count it; replacement beyond six
requires separate authorization.

## 3. Approved materials and outcome boundaries

Use the reconciled [plan](CIVIC_CONTROLLED_HUMAN_VALIDATION_PLAN.md) and exact
[Round 1 materials](CIVIC_HUMAN_VALIDATION_ROUND_1_MATERIALS.md): one fictional
professional-services scenario, three role task sheets, executive brief,
rubric, consent/privacy notice, facilitator guide and burden comparison.
Static plain text/print only; no implementation of a prototype or live account.
Accessibility presentation changes must preserve facts and not teach answers.
No performance, security, procurement, partnership, readiness or commercial claim.

The former nine-participant/two-of-three design is explicitly superseded for
Round 1. Two participants per lens provide directional evidence only.
Use CLEAR_POSITIVE_SIGNAL, MIXED_SIGNAL, MATERIAL_CONCERN or
INSUFFICIENT_EVIDENCE based on evidence quality, not a numerical majority.
Actual eventual round dispositions are HUMAN_VALIDATION_PASS,
HUMAN_VALIDATION_PASS_WITH_LIMITATIONS, HUMAN_VALIDATION_FAIL or
HUMAN_VALIDATION_INCONCLUSIVE; none is assigned now.

## 4. Evidence location, access and clean start

Exact approved root:
`C:\APPS\nzila-os.worktrees\pasted-text-processing\.civic-research\round1`

Classification: `CONTROLLED_HUMAN_VALIDATION_RESEARCH_EVIDENCE`.
Local, non-production, non-repository; separate from all slice proof/anchor and
runtime stores. Only Aubert has default access; no public folder or broad team.
The agent acts on his behalf without independent disclosure, new purpose,
retention change or reviewer access. New reviewers require explicit approval.

Only the minimum directories are established: `administration`, `sessions`,
`observations`, `synthesis`, `consent`. Clean-start inspection found the root and
parent absent, existing ancestors regular and no unrelated content. No unknown
files were deleted. The root has protected NTFS permissions owned by
`AzureAD\AubertNungisa`, with that account the only access-rule principal;
children inherit custodian-only permissions. This is local ACL isolation, not
protection against administrators taking ownership or compromising the host.

The exact local Git exclusion is `/.civic-research/round1/`; no repository-wide
ignore expansion. A non-personal probe was verified ignored/untracked and removed.
Before capture, validate path/ancestors, ACLs, tracked-file absence and contents.
Any reparse point, non-custodian ACL, unapproved file, tracked research evidence or
unrelated content blocks capture. Use
`CIVIC_HUMAN_VALIDATION_RESEARCH_STORAGE_COLLISION` for a storage collision.

## 5. Research record boundary

Do not write participant evidence into repository Markdown, source fixtures,
telemetry, customer records, memberships, proof stores or runtime databases.
No participant records are created by activation.

For future capture, use local JSON records only. Validate before/after writing;
the governance validator is a boundary check, not an evidence-entry application.
All records must declare the classification above, `SYNTHETIC_SCENARIO_ONLY`
and `CODED_ONLY` identity treatment outside administration. Reject unknown keys,
names/contact fields outside administration, recording permissions, real records,
unsupported codes, missing consent, duplicates or session numbers beyond six.
Free-text anonymization remains a facilitator duty: schema checks cannot detect
every indirect identifier or prove that prose is anonymous. Never enter employer
cases. On uncertainty stop and consult Aubert.

- `administration/<code>.json`: minimum scheduling/contact details only as needed
  after participant approval; separate from analysis. Fields: `participantCode`,
  `classification`, `scenarioBoundary`, optional `contactName`, `contactChannel`.
- `consent/<code>.json`: fields `participantCode`, `classification`,
  `scenarioBoundary`, `identityTreatment`, `consentState` (GRANTED or WITHDRAWN),
  `noticeVersion` (`R1-STATIC-1`), `recording` (false). No names or signatures.
  Aubert records informed affirmative consent and supplies notice copy; do not
  capture tasks until granted. Recording would need separately approved handling
  and affirmative recording consent; the current schema deliberately forbids it.
- `sessions/<code>.json`: fields `participantCode`, `classification`,
  `scenarioBoundary`, `identityTreatment`, `sessionIndex` (unique integer 1-6),
  `sessionDate` (UTC within grant), `lens` (D_GATE/R_GATE/T_GATE), `status`
  (COMPLETED/STOPPED), `consentState` (GRANTED). Early termination still counts.
- `observations/<code>.json`: fields `participantCode`, `classification`,
  `scenarioBoundary`, `identityTreatment`, `records` array. Each record has
  `task` (T01-T10), `basis` (OBSERVED_BEHAVIOR/PARTICIPANT_OPINION/
  FACILITATOR_INTERPRETATION), `gate`, `severity` (BLOCKING/MATERIAL/MODERATE/
  MINOR/POSITIVE_SIGNAL), `outcome` (0/1/2), `activeSeconds`, `manualEntries`,
  `duplicateEntries`, `externalLookups`, `reconciliationSteps`,
  `clarifications`, `facilitatorInterventions` (nonnegative numbers) and `note`
  (minimized anonymized text). No material finding merges the three evidence bases.
- `synthesis/round1.json`: fields `classification`, `scenarioBoundary`,
  `identityTreatment`, `participantCodes`, `findings` array of the same coded
  observation structure and `disposition` from the eventual round values above.
  Require actual consented completed sessions before a disposition; incomplete
  coverage must be INCONCLUSIVE or FAIL. No synthesis record exists now.

## 6. Retention and participant withdrawal

Retention is **90 days after ROUND_1_CLOSEOUT**, not 90 days from activation.
Closeout has not occurred; no retention deadline is invented now. Aubert records
the actual closeout and exact review date in a separately reviewed closeout record.
At review, preserve only approved synthesized findings where justified and delete
identifiable raw material unless a separate retention decision exists.
No automatic deletion while findings are under review, a withdrawal/deletion
request is pending or remediation materially depends on unresolved evidence.
Retention review requires human action; no silent extension.

Before synthesis is finalized, withdrawal stops further use of identifiable raw
evidence. Delete or isolate material where reasonably possible; only retain
aggregates that cannot reasonably be attributed. If an integrity/legal constraint
prevents deletion, stop and report instead of silently retaining. Withdrawn notes
are not used in new analysis. Custodian-reviewed isolation/removal is a human
workflow; do not infer broad file-deletion authority or hide an integrity failure.

## 7. Stop, expiry and revocation

`CIVIC_HUMAN_VALIDATION_STOP_REQUIRED` for missing consent, real institutional
data, scope/access expansion, material privacy concern, inadequate scenario,
runtime reopening or production requirements. No product changes between sessions.
No covert/default audio/video. Additional research purpose is prohibited.

Governance admission fails before the exact effective time, at/after expiry,
on revoked/altered grant, missing custody, wrong path, excess sessions, default
recording, real-data permission, identity in coded fields, tracked evidence,
missing materials or changed reviewed plan. Historical documentation review after
expiry can remain archival, but cannot authorize new outreach, sessions or capture.
No automatic renewal or generic future-round category.

Slice 0, Slice 1 and Slice 2 remain terminated, Slice 3 absent,
`runtimeAuthorization.authorized = false`. No production, deployment, pilot,
integrations, accounts, external publication or real institutional data.
All existing proof artifacts/fingerprints and custody remain unchanged.

## 8. Activation recheck and required next control

Readiness requires all static materials, six-session thresholds, approved
storage/custody/access/retention/withdrawal rules and no-recording default.
After `CIVIC_HUMAN_VALIDATION_ACTIVATION_PASS`, stop before sending outreach.
Candidate selection and invitation drafting are the next authorized preparation;
actual outbound messages remain under Aubert's final control.
