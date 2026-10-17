# CIVIC - Controlled Human Validation Plan

**Prepared:** 2026-10-12

**Phase:** `CONTROLLED_HUMAN_OPERATOR_VALIDATION_ROUND_1_PREPARATION`

**Artifact class:** DOCUMENTATION_REVIEW_ONLY; not an execution grant.

**Document kind:** `VALIDATION_PLAN`

**Documentation review:** `DOCUMENTATION_REVIEW_ALLOWED`

**Runtime execution:** `NOT_AUTHORIZED`

**Human session execution:** `ROUND_1_AUTHORIZED_WITH_CONDITIONS`; activation and actual participant approval required.

**Outreach:** `ROUND_1_PREPARATION_AFTER_ACTIVATION_PASS`; no autonomous messages.

**Real data:** `NOT_AUTHORIZED`

**Validation findings:** `NONE`

**Preparation disposition:** Round 1 activation recheck required; no validation outcome.

**External validation / outreach:** Limited to the separate exact Round 1 grant; not granted by this plan.

**Human-session evidence collected:** NONE; all gates UNSCORED.

**Proof owner and retained-proof custodian:** Aubert Nungisa

Read sections 1-4 for scope, 5-10 for the session pack, 11-15 for safeguards and
support, and 16-18 for the authorization decision. This is a static specification,
not a working interface, research findings, production architecture or pilot.

## 1. Objective and accepted synthetic baseline

Can a person understand CIVIC, see why it matters, work through institutional
logic without excessive burden, and make better-governed decisions using it?
The next uncertainty is human usefulness, not another technical slice.

The proof owner explicitly accepted Slice 0, Slice 1 and
[Slice 2](CIVIC_RUNTIME_SLICE_2_PROOF.md) with limitations. All three remain
terminated; `runtimeAuthorization.authorized = false`.
`CIVIC_SYNTHETIC_TECHNICAL_HARDENING_COMPLETE` and
`READY_TO_CONSIDER_CONTROLLED_HUMAN_OPERATOR_VALIDATION` are recorded.
No runtime, archived source, shared package or retained artifact is changed by
this plan. Do not propose Slice 3.

There are no human findings. Ten measured samples per performance cell, the
unfulfilled 100-sample target, same-host anchor trust, absent production systems
and absence of real institutional/user validation remain accepted limitations.
Synthetic acceptance is not security, legal, customer, government, pilot or
deployment approval.

## 2. Research and validation questions

- Can participants answer the eight comprehension questions in section 8 without
  teaching architecture or CIVIC vocabulary?
- Can they distinguish an authoritative record from receipt evidence,
  interpretation and derived arithmetic, including uncertainty and stale authority?
- Can they identify the authorized next decision without treating advice,
  application membership or confidence as institutional authority?
- Does the concept reduce reconciliation more than it adds entry work?
- Can ordinary institution variation use configuration without bespoke kernels?
- What assistance, ownership, support and ongoing review would operation require?
- Can an executive act from a single bounded brief while seeing unresolved gaps?
- What would make a participant reject adoption or return to existing processes?

All are hypotheses to test, not claims already established.

## 3. Participant archetypes and three-lens model

The real names are internal lens references only, not participant selections.
Daphne Osborne, Richard Sharpe and Tom Osborne are possible future validators;
none is contacted, recruited, represented in product data or assigned an account.
Participant-facing material uses fictional roles only.

| Order / gate | Lens / archetype                                                        | Primary question                                                 | Focus                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 / D-GATE   | Daphne / operational coordinator or institutional administrator         | Can an institution adopt, configure, support and live with this? | Comprehension, terminology, workflow, evidence burden, exceptions, confidence, sustainment                                                              |
| 2 / R-GATE   | Richard / delegated-authority or public-service governance practitioner | Would this work inside government machinery?                     | Roles, organizational boundaries, source authority/provenance, temporal validity, conflicting interpretation, institutional memory, governance/adoption |
| 3 / T-GATE   | Tom / accountable executive or professional-services sponsor            | Does this improve stewardship and decision quality?              | Why intervention occurred, authorization, commitment/execution, missing evidence, expected/observed outcome, variance, risk, next decision              |

Historical proposal, explicitly superseded for Round 1: three independent
participants per lens, nine total with two-of-three thresholds. The maintainer
narrowed this to **MAXIMUM 6 PARTICIPANT SESSIONS**, recommended two operational,
two institutional and two executive sessions. This is not merely a count change:
section 16 replaces numerical-majority criteria with evidence-quality signals.
Include a skeptical/non-adopter perspective when selecting candidates.
The sample is directional, not population evidence. One favorable interview
cannot validate adoption. Aubert approves actual people/contact channels before
sending; a person exercising multiple lenses still uses counted sessions.
Run Daphne-lens sessions first and review blocking usability failures before
the other lenses; do not coach later participants using earlier responses.

## 4. One common fictional professional-services scenario

**Scenario:** `SYN-HV-PS-01`, fictional Alder Civic Services Office,
engaging fictional Meridian Practice Studio. No real government record,
supplier, personal identity, organization membership or runtime fixture exists.

As of fictional 2026-09-30, an internal review identifies a 20-working-day
case-reconciliation baseline. The office engages a professional-services team
for a six-week workflow redesign. A fictional director role is authorized up to
CAD 50,000; a coordinator gathers evidence but cannot approve spending.
The engagement commits CAD 40,000 for three deliverables. Expected outcome:
10-working-day reconciliation. Observed outcome: 14 working days, using a small
fictional case sample; causation is not established. Difference: four days
worse than target, six days better than baseline. The fictional review rule
requires review when the target gap exceeds two days or a deliverable is missing.

| ID  | Packet item / source class                                      | What it supports and does not support                                                        |
| --- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| E01 | Need statement / institutional interpretation                   | Explains the 20-day baseline and need; not authority to spend                                |
| E02 | Delegation v1 / fictional authoritative instrument              | Director ceiling CAD 50,000 through 2026-09-20; historically valid at engagement approval    |
| E03 | Delegation v2 / fictional authoritative instrument              | Effective 2026-09-21: director ceiling CAD 30,000; above that goes to executive authority    |
| E04 | Human approval and commitment / fictional authoritative records | Approved CAD 40,000 on 2026-09-01 under E02; not permission for a later extension            |
| E05 | Delivery register / receipt evidence                            | Workflow map and operating guide received; receipt does not prove usefulness or acceptance   |
| E06 | Training attendance / expected evidence, missing                | Third deliverable claimed delivered; no attendance/acceptance record                         |
| E07 | Outcome measure / fictional authoritative measurement           | Observed 14 days; synthetic sample definition available, causal attribution absent           |
| E08 | Intervention plan / approved expectation                        | Target 10 days and review threshold; not observed achievement                                |
| E09 | Supplier narrative / external interpretation                    | Attributes delay to missing client inputs; cannot attest final outcome                       |
| E10 | Coordinator note / institutional interpretation                 | Attributes delay to incomplete training; disagrees with E09, not resolved                    |
| E11 | Prior decision/history / human decision artifact                | Original authorization, later delegation change and receipt history; no historical rewriting |
| E12 | Arithmetic / derived evidence                                   | 14 minus 10 = 4-day variance; 20 minus 14 = 6-day improvement; neither proves causation      |

Decision required: whether to accept the engagement subject to unresolved training
evidence, request remediation, or escalate a proposed CAD 15,000 extension.
The proposed total CAD 55,000 exceeds both the new director ceiling and the
original CAD 50,000 ceiling. No option is automatically approved by CIVIC.
Executive review is required under current E03; legitimate E04 history remains
visible. Missing evidence is not invented and disagreement is not averaged away.

The three role views use identical IDs, dates, figures, gaps and interpretations.
If a scenario defect is found, stop, correct the master version and version every
view; do not silently give different facts to different lenses.

## 5. Static material specification and session structure

Document-only pack specification, not permission to implement a runtime:

- Plain-language cover with role, objective and next action; no doctrine tutorial.
- Source index with E01-E12, source class, owner role, date/version, authoritative
  scope, missing status and fictional locator. No duplicate source documents.
- Decision/history timeline including E02/E03 and unresolved interpretations.
- Institution-configuration comparison card (section 7).
- The single executive decision brief below, not a general dashboard.
- Identical answer/observation sheets for every lens.

### Executive decision surface - participant-facing static card

| Field                     | Scenario value                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| Objective                 | Reduce reconciliation from 20 to 10 working days                                                       |
| Accountable owner         | Fictional services director role                                                                       |
| Authority                 | E02 supported original decision; E03 governs the decision now                                          |
| Intervention              | Six-week professional-services workflow redesign                                                       |
| Commitment                | CAD 40,000 for workflow map, guide and training                                                        |
| Execution                 | Map/guide received; training claimed but unverified                                                    |
| Available evidence        | E04 approval, E05 receipts, E07 outcome sample, E11 history                                            |
| Missing evidence          | E06 training attendance and acceptance                                                                 |
| Expected outcome          | 10 working days                                                                                        |
| Observed outcome          | 14 working days; attribution unresolved                                                                |
| Variance                  | Four days above target, six below baseline                                                             |
| Competing interpretations | E09 missing client inputs vs E10 incomplete training                                                   |
| Risks                     | Unsupported acceptance, causal overclaim, unauthorized extension, extra operator burden                |
| Decision required         | Request evidence/remediation, assess conditional acceptance or escalate extension; do not auto-approve |

Proposed session: 60 minutes, individually facilitated.

1. 0-5: consent confirmation and neutral role/context; no architecture instruction.
2. 5-10: unprompted cover/brief comprehension and eight-question check.
3. 10-30: core evidence/authority/history tasks with observable actions.
4. 30-40: configuration and burden comparison.
5. 40-50: lens-specific decision/support probes.
6. 50-60: interview, plain-language recap, stop/withdrawal reminder.

At most ten minutes per stuck core task, then mark unsuccessful and move on with
permission; do not rescue performance into an independent-success score.
Executive participants see only the brief for the first five minutes. Record
whether full-record navigation was necessary before understanding the decision.

## 6. Tasks and facilitator-only answer key

Do not expose the answer key until first-attempt observations are complete.

| Task | Neutral prompt                                                   | Expected evidence, not a scripted participant answer                                         |
| ---- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| T01  | Why does this matter exist?                                      | E01 baseline/need and E08 target, not "a dashboard project"                                  |
| T02  | Who can authorize the next action?                               | Current E03; escalation for extension; coordinator cannot approve                            |
| T03  | Which information would you rely on, and for what?               | Authority E02/E03, receipt E05, measurement E07; E09/E10 are interpretations                 |
| T04  | What is missing?                                                 | E06 attendance/acceptance and causal certainty; no fabricated completion                     |
| T05  | Where do accounts disagree?                                      | E09 vs E10, both visible, resolution absent                                                  |
| T06  | How did results compare with expectations?                       | 14 vs 10; 4-day gap, 6-day baseline improvement; no causal claim                             |
| T07  | What decision is needed next?                                    | Evidence/remediation/conditional acceptance or executive escalation, not automatic extension |
| T08  | What was decided before and what changed?                        | E04 valid under E02; E03 changed future authority, not past history                          |
| T09  | What is your responsibility and next step?                       | Role-appropriate evidence collection, authority review or executive decision                 |
| T10  | Adapt this to another institution without changing the controls. | Configuration distinctions in section 7, not bypassing authority/history                     |

Daphne lens emphasizes T01/T04/T09/T10 and whether exceptions create extra work.
Richard lens emphasizes T02/T03/T05/T08 and invalid authority interpretations.
Tom lens emphasizes T01/T06/T07 on the executive brief before source drill-down.
All lenses receive the same core tasks; no current gate score is assigned.

## 7. Configuration validation

Test the hypothesis `ONE_GOVERNED_KERNEL + INSTITUTION_CONFIGURATION`,
not `ONE_SIZE_FITS_ALL` or arbitrary bespoke customization.
First ask "What would need to change for your institution?" without these labels.
Then show two fictional configuration cards:

| Configuration surface | Alder Office                             | Birch Service Board                               |
| --------------------- | ---------------------------------------- | ------------------------------------------------- |
| Terminology           | Matter / director                        | Engagement / accountable sponsor                  |
| Roles                 | Coordinator, director, executive         | Evidence steward, sponsor, board delegate         |
| Approval route        | Ceiling-based executive escalation       | Ceiling-based board-delegate review               |
| Evidence obligations  | Delivery receipt and training acceptance | Delivery receipt and independent completion check |
| Policy references     | Fictional E02/E03 delegation versions    | Fictional B02/B03 delegation versions             |
| Reporting             | Monthly variance review                  | Quarterly stewardship review                      |

Ask participants to separate configurable wording/roles/routes/requirements from
non-negotiable human authority, isolation, provenance, historical integrity and
visible uncertainty. Ask which change needs institutional governance approval,
who owns policy/configuration versions and how an outdated configuration is caught.
Record bespoke expectations and unsupported promises as findings for future review.
Do not promise connectors, unlimited customization or live configuration loading.

## 8. Observation rubric and comprehension standard

Before terminology teaching, ask in the participant's own words:
"Why am I here?", "What am I responsible for?", "What is missing?",
"What can I trust?", "Who has authority?", "What changed?",
"What decision is required?", "What happens next?"
An architecture explanation needed to answer is a product failure, not training
success. Record first response before offering help.

Common task scale: **2** correct independently with evidence reference;
**1** correct only after a neutral prompt; **0** wrong, abandoned or requiring
substantive explanation. Record the action and rationale, not just the number.

| Dimension                | Proposed observable criterion                                                                       | Failure signal                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Comprehension            | At least 6/8 answers independently correct within first five minutes                                | Architecture coaching; wrong purpose/role/next step               |
| Confidence               | Correct source classification and scope; 1-5 confidence recorded before feedback                    | High confidence in E09/E10 as binding evidence                    |
| Burden                   | Entry, lookup, navigation, explanation and reconciliation counts/times recorded                     | Duplication or governance overhead exceeds reconciliation saved   |
| Authority clarity        | T02 and T08 independently correct                                                                   | Approval by coordinator, obsolete authority, rewritten history    |
| Decision usefulness      | T07 identifies gap, authorized options, owner and next action without full-record-first requirement | Dashboard summary with no actionable or authorized next step      |
| Configuration confidence | Distinguish all six configuration surfaces from protected controls                                  | "Bespoke kernel required" or configurable authority bypass        |
| Support expectation      | Identify assistance, responsible role and escalation needs in lifecycle                             | Unowned policy changes, unworkable staffing or support dependency |

These thresholds are proposed protocol criteria to approve before recruitment,
not validated benchmarks. Confidence ratings are not correctness evidence.

## 9. Burden measurement and comparison

Use the same scenario facts for a conventional static packet and the CIVIC static
pack. Alternate order across participants in each lens; record order and learning
effects. If equivalent comparison or counterbalancing is infeasible, report burden
as descriptive only. A document walkthrough cannot establish live workflow savings.

Per task record elapsed active time (exclude consent/breaks), manual entries,
repeated fields, corrections, external-source lookups (simulated only), navigation
steps/backtracking, reconciliation minutes, neutral prompts, substantive
explanations, confusion points and avoidable governance steps. Count an entry as
one participant-entered field; count re-entry of an already supplied fact separately.

Compute separately:

- Reconciliation saving = conventional reconciliation time minus CIVIC time.
- New entry overhead = CIVIC entry time minus conventional entry time.
- Net burden change = CIVIC total active task time minus conventional total time.

Round 1 burden evidence requires positive reconciliation saving exceeding positive
new-entry overhead, no unnecessary duplicate entry, and no increase in total active
time at equal or better correctness in comparable tasks. Report each of the two
operational participants separately and preserve contradictory results. No
two-of-three threshold remains active. Missing comparison is insufficient evidence,
not a claimed reduction. Do not infer population efficiency from static sessions.

## 10. Interview questions

Ask after observed tasks; do not use these to coach task responses.

- Explain what this concept does and when you would not use it.
- Which part made you hesitate? Show the exact point.
- What did you trust, and what would change your mind?
- What would you do if the requested evidence never arrives?
- What did you have to enter or look up twice?
- Which step would you remove, and what governance risk would that create?
- What institutional rule or role did the scenario misrepresent?
- What would make ordinary configuration insufficient?
- Who would own onboarding, configuration, training and incident response?
- What support do you expect before launch and during operation?
- What happens when policy changes or an administrator leaves?
- Could you brief an executive from this surface alone? What is missing?
- What next decision is clearer, and what remains unresolved?
- What would prevent adoption even if the technical proof works?

Record stated expectations separately from observed behavior. Do not fabricate
quotes or treat politeness, purchase interest or expert endorsement as validation.

## 11. Evidence capture and proposed review template

No participant evidence is collected now. Round 1 uses the separately approved
exact location, custodian-only access and 90-day-after-closeout retention in the
[authorization record](CIVIC_HUMAN_VALIDATION_ROUND_1_AUTHORIZATION.md).
No session notes or personal identifiers belong in source control or proof stores.

Proposed minimal record:

`session pseudonym | lens | role archetype | consent version |
pack version | task | order | timestamps | first response/action |
source IDs consulted | outcome 0/1/2 | counts/times |
neutral/substantive help | confidence before feedback |
observed behavior | stated expectation | facilitator interpretation |
D/R/T gate | severity | counter-evidence | unresolved question`

Keep factual observations separate from interpretation; exact quotes only with
explicit permission. Record every failure/withdrawal and missing denominator.
Use sanitized aggregate findings for repository documentation only after approval.
No audio/video, analytics, telemetry, screenshots of participants or external
AI/transcription upload without additional explicit authorization.

## 12. Consent and privacy considerations

Proposed script for future approval: "This is a fictional concept walkthrough,
not a test of your competence. Participation is voluntary. You may skip questions
or stop without consequence. We are not requesting real institutional records.
We will explain what notes are collected, who sees them and when they are deleted
before you decide whether to participate."

Round 1's approved notice in the
[materials](CIVIC_HUMAN_VALIDATION_ROUND_1_MATERIALS.md) defines custody, retention,
withdrawal/correction and small-group anonymity limits. Separate necessary contact
scheduling details from coded findings; use the approved local directory only.
No recruitment email is prepared by this activation mission.
If recording is later proposed, require separate consent and approved handling.

## 13. Prohibited data and participant boundary

No real institutional records, delegations, contracts, invoices, case files,
customer/government data, personal data in product fixtures, credentials, secrets
or production accounts. Do not ask participants to upload examples or log into
institutional systems; use only E01-E12. Real lens names are not runtime personas,
telemetry identities, customer records or memberships.

If a participant volunteers sensitive material, stop capture, do not copy it into
the repository, restrict access and notify the approved custodian. Resume only
after authorized handling. The future consent record itself is human data and
requires its own approved storage, not a synthetic-runtime directory.

## 14. Support model hypothesis

`DISCOVER -> CONFIGURE -> VALIDATE -> LAUNCH -> OPERATE -> REVIEW -> EVOLVE`

This is a provisional lifecycle to test, not a commercial promise or present
authorization to launch.

| Stage     | Assistance hypothesis / institutional owner question                        |
| --------- | --------------------------------------------------------------------------- |
| DISCOVER  | Identify need, existing reconciliation burden and accountable sponsor       |
| CONFIGURE | Help administrator map terminology, roles, routes and evidence rules        |
| VALIDATE  | Institution verifies policy/authority fit and workflow understanding        |
| LAUNCH    | Training and handover; ask who approves readiness and staffs support        |
| OPERATE   | Administrator support, incident channel and authority/data issue escalation |
| REVIEW    | Periodic institutional review, support demand and burden assessment         |
| EVOLVE    | Governed policy/model/configuration changes and retraining                  |

Probe expected onboarding effort, configuration assistance, training format,
administrator capacity, support channel/escalation, policy/model evolution,
ongoing institutional review and ownership handoffs. Record expected response times
and costs as participant hypotheses; promise no SLA, subscription tier or service.
Authority interpretation remains an institutional responsibility, not a helpdesk
or AI decision.

## 15. Facilitator guidance

Use fictional role cards, identical facts and neutral prompts. Do not teach kernel,
OCI, delegation model or CIVIC terminology before first-attempt measurement.
Say "What would you do next?" rather than "Have you checked the delegation?"
Log every explanation. Architecture rescue is a product failure even if the
participant subsequently succeeds.

Do not sell, defend the design, resolve disagreement for the participant or
promise missing capabilities. Preserve minority interpretations and negative
results. Ask for a break or stop when fatigue affects performance.
Aubert is the sole approved facilitator and default evidence-access holder.
An observer or delegated facilitator needs additional explicit approval.
Provide accessible plain text and large-print options; approve any additional
accessibility needs before sessions. Do not score disability-related accommodation
as product confusion.

## 16. Success, failure and decision framework after sessions

All current D/R/T scores are **UNSCORED**. Historical READY/READY_WITH_LIMITATIONS/
NOT_READY preparation labels are not Round 1 outcomes. After actual sessions only,
use HUMAN_VALIDATION_PASS, HUMAN_VALIDATION_PASS_WITH_LIMITATIONS,
HUMAN_VALIDATION_FAIL or HUMAN_VALIDATION_INCONCLUSIVE; no outcome is assigned now.

Each lens has at most two sessions and is classified by evidence quality:

- `CLEAR_POSITIVE_SIGNAL`: comparable independent correct core tasks in both
  usable sessions, supporting evidence references and no unresolved material risk;
  directional only, not an automatic PASS.
- `MIXED_SIGNAL`: divergent behavior, partial usefulness or prompt dependence;
  preserve disagreement rather than majority scoring.
- `MATERIAL_CONCERN`: unsafe authority, repeated source/decision error, extensive
  coaching, net burden increase, required custom fork or unusable executive brief.
- `INSUFFICIENT_EVIDENCE`: fewer than two usable relevant sessions, missing consent,
  withdrawal, incomplete comparison or solely participant opinion.

Six-of-eight independent comprehension answers remains an individual observation
indicator, never a lens majority. D-GATE requires section 9 comparable burden;
R-GATE source/version/role clarity; T-GATE brief-first decision/variance/authority
clarity. Record individual evidence, counter-evidence and limits. Numerical
majority alone never establishes success.

| Gate   | Failure examples                                                               | Future decision                                                        |
| ------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| D-GATE | Added reconciliation/entry burden, architecture coaching, support unowned      | Revise concept/support assumptions; do not claim operational viability |
| R-GATE | Wrong authority, interpretation treated as binding, missing provenance/history | Halt progression and resolve institutional model mismatch              |
| T-GATE | Executive cannot identify why/variance/next decision without record hunting    | Revise bounded decision surface; no general dashboard expansion        |

A single critical unsafe-authority/privacy outcome stops progression regardless
of favorable opinion. Missing sessions/evidence yield INCONCLUSIVE, not silent pass.
Proof owner reviews findings, disagreements and limitations before any next-phase
decision. Improvements are proposals only. A material technical defect can justify
a separately authorized bounded correction; minor preferences do not restart
synthetic slicing. No gates are pre-scored by this preparation.

## 17. Stop conditions and design limitations

Stop for unapproved outreach/access, real data, inadequate consent, unsafe
authority interpretation, participant distress/withdrawal, recording without
permission, pack inconsistency, prohibited storage or expired/revoked approval.
Keep runtime closed even if a live demonstration is requested.

Limits to challenge after approval:

- Static cards cannot validate live navigation, latency, configuration loading
  or sustained burden; do not confuse concept comprehension with product usability.
- Small expert/convenience samples and sponsor presence bias results; include
  skeptical perspectives and keep behavior separate from courtesy.
- Repeating one scenario creates learning effects; counterbalance and disclose.
- A professional-services example does not establish broader public-service fit.

No human result is currently known. Revision triggers: comprehension failures,
net burden increase, unsafe authority assumptions, unowned support, unmet
accessibility needs or an institution requiring protected-control customization.

## 18. Readiness and next authorization required

The initial documentation-only amendment remains historical, not session authority.
The maintainer now approves reconciliation with the exact finite Round 1 grant,
evidence rules and two additional exact governance paths. All three accepted slices
remain terminated; source and retained evidence stay unchanged; general runtime
authorization false; no real institutional data, production or future-round grant.
The reconciled reviewed plan and two new artifacts remain fingerprint-bound.
Changed permission text or invented findings cannot inherit review.

The [Round 1 authorization](CIVIC_HUMAN_VALIDATION_ROUND_1_AUTHORIZATION.md)
preserves effective `2026-10-12T23:59:13.9553409+00:00` and expiry
`2026-11-11T23:59:13.9553409+00:00`, six-session limit and Aubert facilitation.
The [static materials](CIVIC_HUMAN_VALIDATION_ROUND_1_MATERIALS.md) contain the
consent notice and reconciled rubric. No participants/results are populated.

This is documentation-gate readiness only. No person has validated CIVIC, no
D/R/T gate is scored and no burden reduction is demonstrated.

The bounded protocol now supplies the following controls; after activation PASS,
actual participant selection and outbound sending remain under human control:

1. Approved plan/pack version, questions, success/failure thresholds and wave size.
2. Eligible participant archetypes and exact individuals/contact channels;
   explicit outreach, recruitment and scheduling permission.
3. Facilitator/observer, session dates, finite effective/expiry window, revocation
   and stop/escalation owner.
4. Static materials and presentation mode; no runtime, live access or accounts.
   Any prototype implementation/live demonstration needs separate scoped authority.
5. Consent/privacy wording, accessibility arrangements, capture method, exact
   evidence storage, custodian, authorized access and retention/withdrawal/deletion.
6. Synthetic-only materials, prohibited-data handling, findings review and next
   decision owner; no pilot, real data or deployment permission.

Only the separate Round 1 grant supplies limited human-validation authority;
this plan and synthetic proof alone do not. Retained artifacts remain untouched.
Post-acceptance cleanup is a separate decision.

### Historical preparation verification - before the archival amendment

- `pnpm exec vitest run --config tooling\contract-tests\vitest.config.ts tooling\contract-tests\civic-oci-doctrine-integrity.test.ts`: PASS, 194 tests.
- `pnpm exec tsx scripts\validate-civic-oci-doctrine.ts`: FAIL/BLOCKED by this
  exact plan path as `unauthorizedChangedPaths`. Subsequent archival/runtime-source
  findings are downstream denials, not newly introduced executable source.
- Acceptance-only supplied-context diagnostic, excluding only this plan path
  from the changed-path list: PASS. This isolates the prerequisite; it is **not**
  actual-context validation or permission to ignore the plan in governance.
- Exported Slice 0/1/2 guards: all return expected termination denial.
  General runtime authorization remains false.
- All 11 final Slice 2 source fingerprints, 204 retained Slice 2/anchor payload
  digests and 22 Slice 1 payload digests: unchanged.
- Existing read-only `runDocConsistency` audit: zero scoped errors/warnings;
  five informational platform-name suggestions in exact authorized Windows paths.
  All 12 scoped relative documentation links resolve.
- Scoped Prettier, `git diff --check` and exact-surface checks in all three other
  worktrees: PASS. No runtime/shared-source changes in this mission.

No external sessions, findings, gate scores, outreach or cleanup occurred.
Immutable technical-closeout manifests retain their historical pending-acceptance
metadata; the later human decision is recorded in the proof document, not by
rewriting historical evidence.

### Documentation-only archival amendment - 2026-10-12

The exact-path amendment is recorded in
[CIVIC doctrine integrity](../../oci/CIVIC_OCI_DOCTRINE_INTEGRITY.md).
Review admission verifies pinned unchanged retained inventories and their payloads
as well as all three slices' existing source fingerprints. No stored evidence or
archived source is rewritten to admit this document. The earlier amendment supplied no session permission. The new Round 1 authorization,
not that historical amendment, supplies the finite controlled research scope.

No outreach, participant records, completed findings or outcome are created by
this reconciliation. Activation PASS permits outreach preparation only; stop
before actual sending.
