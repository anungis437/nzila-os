# Cora Round 1 Authorization Decision Pack

**Version:** `cora-round1-authorization-decisions-1.0`
**Date:** 2026-10-10
**Pack disposition:** `CORA_ROUND1_AUTHORIZATION_PACK_READY`
**Current outreach gate:** `ROUND1_OUTREACH_HOLD`
**Current collection gate:** `ROUND1_COLLECTION_NO_GO`

Round ready for authorization is not round authorized. Preparation only:
no people, organizations, channels, storage locations, personnel, retention
periods or compensation have been selected. No human evidence exists.
Recommendations below require explicit decisions; silence is not approval.

## Minimum decision package

Read this register first, then the
[operating recommendation](CORA_HUMAN_VALIDATION_OPERATING_MODEL_RECOMMENDATION.md),
[consent register](CORA_HUMAN_VALIDATION_CONSENT_DECISION_REGISTER.md) and
[data map](CORA_HUMAN_VALIDATION_DATA_MAP.md).
Record actual decisions in an approved restricted authorization record,
not by inserting participant/contact information into this repository.

The accepted [Round 1 plan](CORA_HUMAN_VALIDATION_ROUND_1_PLAN.md),
[manifest](CORA_HUMAN_VALIDATION_ROUND_1_MANIFEST.json),
protocol, rubric, schema, QA, stop rules and advancement gate remain the
study baseline: twelve independent participants, three per persona,
61 scheduled responses / 122 points each, up to 90 minutes with breaks or
two 45-minute sittings. No reduced questions or altered denominators.
At the time limit, pause rather than rush or impute answers; an incomplete
session cannot fill a qualifying slot. Any extension beyond that envelope
requires a separate decision, not an automatic extra sitting.

The plan receives only four decision-artifact links. Because its bytes are
pinned, its manifest digest must be refreshed for this link-only amendment.
The prior plan digest was
`2412fe7045cb59f0f5676dc9a7b07e755b410c92dd9db63d698b5294d4193f76`.
This administrative repin changes no study version, reference, question,
allocation, gate, authorization flag or other instrument digest.

## Explicit decision register

All D01-D25 are **unresolved**. Recommended defaults are proposals, not
chosen values. "Before outreach" includes recruiting, interest replies and
screening because those activities already process personal information.
Approve policy/design before outreach; verify actual implementation before
scheduling or collection as separately indicated.

| ID  | Question Aubert must decide                                                                                | Recommended default (unapproved)                                                                                                                | Viable alternatives                                                                                | Risk / trade-off                                                                                                   | Privacy/legal review                                               | Required stage                                                            |
| --- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| D01 | Who is accountable as research owner, with authority to pause and handle incidents?                        | One named accountable owner; do not infer Aubert is the operational owner.                                                                      | Named delegate with documented escalation.                                                         | Unowned requests/incidents; delegation needs clear authority.                                                      | Review accountability.                                             | Before outreach; availability before collection.                          |
| D02 | Who sends invitations and through which participant contact/reply method?                                  | One approved sender and existing approved direct channel; no bulk tools, tracking pixels or repeated-contact campaign.                          | Approved private referral or separately reviewed channel.                                          | Familiarity bias; channel metadata and third-party handling.                                                       | Review channel and contact-data use.                               | Before outreach.                                                          |
| D03 | Who is the research/privacy rights-request contact and what usable route is supplied?                      | Named reachable research and privacy contacts; combine only if competence/conflicts permit.                                                     | Separate privacy officer or qualified adviser.                                                     | Unanswered complaints; same person can have conflicting responsibilities.                                          | Required.                                                          | Before outreach; availability through deletion.                           |
| D04 | Which participant/owner locations, applicable jurisdictions and lawful basis govern each processing stage? | Qualified privacy/legal assessment before approval; no assumption of Canadian-only applicability.                                               | Restrict approved geography after assessment, or review broader geography.                         | Cross-border duties and employment/power imbalance; consent alone is not a legal conclusion.                       | Required.                                                          | Before outreach.                                                          |
| D05 | What exact storage locations, devices and protections hold each data class?                                | Approved encrypted local research storage outside repository, separate contact key, no new SaaS tooling.                                        | Already approved managed organizational store with reviewed terms.                                 | Local device loss; sync/backup copies; managed services add processors.                                            | Required.                                                          | Policy before outreach; verify controls before any intake and collection. |
| D06 | Who has access to contact keys, captures, notes, review logs and outputs?                                  | Named least-privilege list by data class; reviewers receive pseudonymous material, not contact key.                                             | Approved restricted research team with documented substitutions.                                   | Excess access/re-identification; small team independence constraints.                                              | Required.                                                          | Before outreach; verify assignments before collection.                    |
| D07 | What exact contact-key retention end date/event, maximum duration and deletion responsibility apply?       | Short bounded period sufficient for approved logistics/withdrawal; specify exact dates and owner, not indefinite retention.                     | Earlier deletion with honestly disclosed withdrawal limitations.                                   | Early key destruction can prevent withdrawal; long retention increases identification risk.                        | Required.                                                          | Before outreach, including declines/nonresponses.                         |
| D08 | What exact response/notes/review retention end date/event and maximum duration apply?                      | One bounded reviewed policy for linked research records; separate minimal audit evidence if justified.                                          | Separate justified durations by class.                                                             | Review needs versus exposure; audit records must not preserve deleted response text.                               | Required.                                                          | Before outreach; confirm before collection.                               |
| D09 | Is recording permitted?                                                                                    | No audio, video, screenshots of participants, recording, automated transcript or meeting assistant.                                             | Separately reviewed/authorized optional recording with individual opt-in and retention.            | Notes can lose nuance; recording adds sensitive content and processor risks.                                       | Review no-recording configuration; new approval for any recording. | Before outreach; verify devices before collection.                        |
| D10 | What exact withdrawal cutoff and post-cutoff limits will be communicated?                                  | Reachable request route; cutoff after review and before irreversible de-identification/publication; exact event/date must be approved.          | Longer withdrawal window with retained key or shorter justified window.                            | Cannot promise removal from irreversibly de-identified aggregates; retained key increases risk.                    | Required.                                                          | Before outreach.                                                          |
| D11 | Which backups/sync copies exist, how long recoverable, and how does deletion survive restore?              | Inventory verified copies; bounded expiry and restore-time suppression, with honest participant wording.                                        | Reviewed no-backup environment if loss risk is acceptable.                                         | No instant-purge guarantee; no backups increase loss risk.                                                         | Required.                                                          | Before outreach; implementation verification before intake.               |
| D12 | Are direct quotations or public outputs authorized?                                                        | No direct quotes and no public release for Round 1; internal de-identified paraphrases only after review.                                       | Separate opt-in for reviewed quotation and specified audience; separately approved public summary. | Distinctive language/role can identify participants even without names.                                            | Required.                                                          | Before outreach; release review before any output disclosure.             |
| D13 | Is compensation offered, and on what terms?                                                                | No compensation proposed for simplicity; Aubert must explicitly choose, not default silently.                                                   | Fixed reviewed honorarium or expenses, not tied to completion/correctness.                         | No compensation can skew availability; payments add identifying/financial records and inducement risk.             | Review chosen policy.                                              | Before outreach.                                                          |
| D14 | Who moderates, and can they observe without leading or dependency pressure?                                | Named trained moderator with synthetic-only rehearsal and conflict screen.                                                                      | Independent external moderator under approved handling.                                            | Implementer bias; external person adds access and cost.                                                            | Review confidentiality/power relationships.                        | Assignment before outreach; rehearsal before collection.                  |
| D15 | Who observes and records first answers/confidence/navigation reliably without recording?                   | One named neutral observer/note-taker distinct from moderator.                                                                                  | Solo moderation only after demonstrated reliable capture and explicit approval.                    | Extra observer increases access; solo mode risks material loss across 61 tasks.                                    | Review access and participant notice.                              | Assignment before outreach; feasibility before collection.                |
| D16 | Who provides initial coding, independent second review and adjudication?                                   | Named R1, distinct R2 independent for reviewed observations, and third independent R3 for disputes; protect blind coding.                       | Authorized external reviewer or defer until independence is available.                             | Self-review cannot close critical/high/disputed findings; small team can lack independence.                        | Review access/conflicts.                                           | Assignments before outreach; verified before collection/review.           |
| D17 | Which recruitment-source categories may be used per persona, with what eligibility/bias safeguards?        | Approved private opt-in/referral categories; no lists, scraping, dependent relationships or answer-key-exposed candidates.                      | Approved association/professional/program referral routes.                                         | Convenience/gatekeeper bias and perceived endorsement.                                                             | Review lawful contact use and voluntariness.                       | Before outreach; category-level screening before scheduling.              |
| D18 | Which persona and slots come first?                                                                        | Producer/operator first; proposed first wave P01, P02 and P04 (two producers and one adviser), unchanged slot roles/orders.                     | Three producers, three advisers, or different approved mixed wave.                                 | Early practical coverage versus within-role coverage; three people cannot establish a round pass.                  | Review dependency risks of actual sources.                         | Before outreach.                                                          |
| D19 | Staged or full recruitment, and who releases the second wave?                                              | `3 -> review -> remaining 9`; no second-wave outreach until explicit Aubert release.                                                            | All twelve initially with the same stop rules.                                                     | Staging delays completion but protects scarce institutional relationships.                                         | Review any added contact/holding period.                           | Before outreach; release before second-wave contact.                      |
| D20 | Local or remote sessions, and which setting/platform is approved?                                          | Accessible local synthetic-window interaction, no recording/screenshare; actual setting remains unselected.                                     | Reviewed remote synthetic-window viewing without recording.                                        | Local travel burden; remote metadata, cross-border processors and accidental screen exposure.                      | Required for selected setting; separate remote/screenshare review. | Before outreach; participant-specific fit before scheduling.              |
| D21 | How are times proposed, confirmed, reminded and cancelled?                                                 | Manual coordination through approved direct channel, no new scheduling tool/calendar integration.                                               | Already approved scheduling service with minimized metadata.                                       | Email/device copies still count; third-party calendar disclosure.                                                  | Review chosen route.                                               | Method before outreach; separate scheduling authorization before booking. |
| D22 | How are accessibility, screening and split-session choices captured minimally?                             | Broad role and practical accommodation needs only; no medical details, employer names or documents proving experience.                          | Reviewed additional necessary support.                                                             | Need to accommodate without collecting unnecessary sensitive information or coaching.                              | Required.                                                          | Policy before outreach; actual fit before scheduling/collection.          |
| D23 | Who approves final invitation/info/consent/reminder/thanks and the exact data-use purposes?                | Versioned final materials limited to synthetic comprehension and internal design proposals; no endorsement or broader reuse.                    | Separately reviewed broader use with new permission.                                               | Purpose creep; drafts with unresolved placeholders are not sendable.                                               | Required.                                                          | Before outreach; matching consent reaffirmed before collection.           |
| D24 | What are request, incident, redaction, deletion and audit procedures and responsible personnel?            | Written bounded process across stores; restricted corrections, no sensitive text in audit markers, no physical deletion claim without evidence. | Approved organizational procedure mapped to this study.                                            | Append-only research logs conflict with privacy deletion unless actual content is removed/restricted under policy. | Required.                                                          | Before outreach; feasibility before intake/collection.                    |
| D25 | What stage, participant scope, dates and expiry does each authorization actually permit?                   | Separate explicit outreach, scheduling and collection records; first-wave scope only until released.                                            | One signed record with distinct independently approved stage clauses.                              | Broad vague approval can be misread as collection/whole-round permission.                                          | Check consent remains independent of owner authorization.          | Before each corresponding external action.                                |

Use [consent items C01-C28](CORA_HUMAN_VALIDATION_CONSENT_DECISION_REGISTER.md)
to record RESOLVED evidence or an explicit blocker. No decision is resolved
merely because the suggested default is listed. Names and actual contact
routes belong only in the approved restricted decision record.

## Separate GO / NO-GO gates

These are manual authorization gates, not implemented Cora runtime controls.
Unknown values fail closed. Gate evidence includes named approvers, dated
decision record/version, stage and slot scope, expiry/conditions, reviewed
materials/configuration references, and verification results.

| Gate                      | Exact condition                                                                                                                                                                                                                                                                                                                                                                           | Permitted scope                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ROUND1_OUTREACH_HOLD`    | Decision/review/finalization evidence is absent or pending, with no explicit rejection. **Current state.**                                                                                                                                                                                                                                                                                | Preparation only; no invitation, referral request, screening, interest intake or booking.                               |
| `ROUND1_OUTREACH_NO_GO`   | Aubert declines, review rejects proposed processing, an unmitigated risk/stop rule is active, or previous authority is withdrawn/expired.                                                                                                                                                                                                                                                 | No new outreach; handle any existing records only under separately applicable policy.                                   |
| `ROUND1_OUTREACH_GO`      | All before-outreach D items and applicable C items resolved with evidence; final participant material/privacy handling and personnel/logistics design approved; intake storage verified; no stop condition; explicit unexpired Aubert outreach statement specifies sender/channel, source categories and first-wave scope.                                                                | Only approved invitations, voluntary interest replies and minimal screening. No scheduling or comprehension collection. |
| `ROUND1_COLLECTION_NO_GO` | Any missing prerequisite, lack of scheduling/collection authority, absent participant consent, version mismatch, unavailable personnel, implementation failure, privacy failure or round stop. **Current state.**                                                                                                                                                                         | No comprehension collection. Resolve blockers without treating outreach approval as collection permission.              |
| `ROUND1_COLLECTION_GO`    | Separate scheduling authorization where needed; explicit collection authorization for named slot scope; frozen reference/instruments verified; finalized notice and actual voluntary consent; approved storage/access/retention/deletion verified; rehearsed moderator/observer and independent review available; accommodated format, time envelope and QA confirmed; no stop condition. | Only bounded approved synthetic study collection. No provider data, credentials, live sources or production claims.     |

Outreach GO alone permits no calendars, appointments, consent collection
for sessions or research answers. Scheduling requires its own explicit
clause after minimal screening and availability of finalized participant
information; arranging a time is not consent to research collection.
Participant withdrawal/refusal overrides any owner authorization.

Before releasing wave two, review all three full first-wave sessions, QA,
critical/high findings, blind second reviews where required, burden and
privacy incidents. Any round-stop trigger keeps later recruitment/sessions
paused. An unresolved critical/high finding or dispute holds wave release
pending disposition; one critical finding is reviewed immediately, never
waited on until session three. A clean first wave only supports Aubert's
explicit release of nine remaining slots, not advancement or population claims.
Any UX/protocol revision follows accepted new-version/cohort/retest rules;
do not replace failures or pool cohorts to manufacture a pass.

## Draft authorization statements - not approvals

Replace every bracketed value with an actually approved restricted record
reference before use. These paragraphs are proposed wording, not Aubert's
signature or authorization.

**Outreach authorization**

> I authorize Round 1 recruitment outreach only for [approved first-wave slot scope] under authorization record [ID/version/date/expiry], using [approved source categories], [approved sender and contact/reply channel], and [final approved invitation/information/privacy versions]. Only voluntary interest replies and approved minimal screening may be processed under the approved storage, access, retention and request-handling constraints. This does not authorize scheduling, calendar events, session consent/data collection, recording, screenshare, second-wave outreach or live/provider work.

**Separate scheduling authorization**

> I authorize manual scheduling only for [eligible approved slot scope] under [record ID/version/date/expiry], through [approved method and final scheduling/reminder versions], within the accepted 90-minute or two 45-minute envelope and approved accommodation/privacy constraints. This does not authorize research collection, recording, screenshare or expansion.

**Collection authorization**

> I authorize synthetic Round 1 collection only for [approved first-wave slot scope] under [record ID/version/date/expiry], the frozen manifest `cora-human-validation-round-1-v1.0` and verified reference `cora-slice8-reference-v1.0`, finalized consent/data-handling configuration [version], and approved moderator, observer and independent reviewer/adjudicator assignments [record]. Collection requires each participant's actual voluntary informed consent and verified controls. Existing QA/stop/retest rules remain binding. No recording, screenshare, second-wave collection, real provider data or production use is authorized.

**Later wave release**

> After reviewing [first-wave QA/review/disposition record], I authorize [specified remaining-wave outreach/scheduling/collection stages and slots] under [updated record/version/expiry] with unchanged study instruments and approved handling. No unresolved stop condition is waived. Any study revision requires separate authorization.

## Current decision

The pack is ready for a decision; the proposed operating model is not approved.
Outreach remains HOLD, collection remains NO-GO, all slots remain uncontacted,
and all actual staffing/privacy/storage/retention choices remain unresolved.
No invitations, referral requests, calendar events, participant names or human
data have been created. Deere/FieldView/Organic Alpha rights gates, Phase 3
permission and the Cora product ceiling remain unchanged.
