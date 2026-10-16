# Cora Round 1 Bounded Research Data Map

**Version:** `cora-round1-data-map-1.0`
**Date:** 2026-10-10
**Status:** PROPOSED LOGICAL STORES ONLY - NO HUMAN DATA OR STORAGE CREATED

The map specifies separation and deletion dependencies, not actual locations
or an implemented storage/authorization service. Aubert and qualified
privacy/legal review must approve exact locations, access holders, purposes,
retention dates/events, backups and procedures via
[D01-D25](CORA_HUMAN_VALIDATION_AUTHORIZATION_DECISION_PACK.md) and
[C01-C28](CORA_HUMAN_VALIDATION_CONSENT_DECISION_REGISTER.md).
Pseudonymous is not anonymous, especially with three people per persona.

## Data classes and logical stores

| Store                                 | Bounded contents                                                                                                                                                                                                                           | Identification class                                                                                                                                            | Proposed permitted access (unassigned)                                                                                   | Creation stage and purpose                                                                                                    | Retention / deletion dependency                                                                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M0 authorization/configuration record | Decision IDs, approved handling/material versions, stage/slot scope, named authorized staff, review signoffs and expiries. No participant answers/contact list.                                                                            | Staff identifying data; slot metadata not proof of participation.                                                                                               | Owner/privacy approver; operators receive necessary policy subset.                                                       | Before outreach, only after staff/configuration selection is authorized; proves authority and limits.                         | D08/D24 must define bounded administrative evidence retention; minimize names when no longer needed. Never embed withdrawn response content.                                               |
| M1 separate contact key and logistics | Minimal contact/reply route, slot link if allocated, broad-role eligibility, invitation/decline status, agreed times, functional format needs. No answers, employer/farm records or medical diagnoses.                                     | Identifying; contact link re-identifies pseudonymous records.                                                                                                   | Approved logistics/owner only; moderator gets minimum necessary coordination. No analyst/reviewer key access by default. | Authorized outreach for interest/screening; approved scheduling adds times. Existing source contact lists are not imported.   | D07 applies also to declines, nonresponses and excluded candidates. Withdrawal requires key-assisted lookup across stores before key destruction. Copies in sender/scheduling tools count. |
| M2 study captures and external index  | Approved 1.0 HUMAN_SESSION records: slot/capture IDs, actual consent/authorization references, 61 first answers/confidence, scores/flags, version/digest, timing/interaction. Index joins study/reference, QA/review IDs and block status. | Pseudonymous; answers/context can directly identify if unredacted. Consent proof/references remain personal data, no unnecessary signature/contact copies.      | Approved moderator/note-taker/initial analyst; independent reviewer receives required blinded subset.                    | Separate collection authority plus actual consent; comprehension evidence only. Repository P01-P12 blanks stay metadata-only. | D08/D10/D24 cover captures, index and exports. On withdrawal, find by slot/capture IDs, remove/restrict actual content according to approved policy; no invented completed session.        |
| M3 moderator/observer notes           | Locked exact first answers where needed, confidence, neutral prompt/mechanics, navigation/timing/censoring and accommodation effects. No real records or unnecessary identifying anecdotes.                                                | Pseudonymous by design, potentially identifying free text.                                                                                                      | Approved moderator/observer and necessary analyst/reviewer subset.                                                       | Authorized collection; preserve first-answer fidelity without recording.                                                      | Same response-retention policy, unless a separately justified duration is approved. Transcribe/verify without duplicate indefinite notebooks; all working copies inventoried.              |
| M4 optional recording                 | None proposed. If separately approved: defined audio/video/screenshare contents, affirmative opt-ins, version and limited scope.                                                                                                           | Identifying and potentially sensitive voices/faces/screens; never assumed pseudonymous.                                                                         | Separately approved recording custodians; no general reviewer access by default.                                         | Only new explicit recording authority and participant-specific consent; not created in this mission.                          | C10/C16/C22 need exact retention/destruction, processors/backups and withdrawal linkage; NOT_APPLICABLE only after approved exclusion.                                                     |
| M5 QA/review/adjudication             | First-answer locks/hashes, provenance, QA flags, independently coded rationale, reviewer refs, comparison/dispute/adjudication events, retest links.                                                                                       | Pseudonymous participant data plus identifying staff refs; answer excerpts/hashes are not anonymous.                                                            | Approved R1/R2/R3; R2 blinded to proposed score and desired outcome until independent code.                              | Authorized handling of collected evidence; critical/high/disputed review under accepted QA.                                   | D08/D24 apply to excerpts, replicas and caches. Preserve only permitted redaction/deletion/disposition marker, not immutable response text after approved deletion.                        |
| M6 analytical outputs                 | Restricted tables by slot/persona/scenario/guardrail, confidence versus correctness, limitations and disposition; reviewed aggregates/paraphrases. No direct quote/public output proposed.                                                 | Slot-level and small-cell role outputs remain pseudonymous/potentially identifying; only reviewed irreversibly de-identified outputs can be treated separately. | Named analysts/owner; broader internal or external access requires separately approved release.                          | Authorized analysis after QA; no premature pass claim or population generalization.                                           | D08/D10/D12 determine cutoff/release and retention. Remove/recompute linked restricted outputs before cutoff; document actual irreversible/publication limits, never automatic immunity.   |
| M7 request/deletion/incident log      | Minimal request reference, store scope, timestamps, actions, responsible staff, evidence/limitations and restore suppression key where justified. No full deleted answers or sensitive disclosure text.                                    | Identifying/pseudonymous as necessary; hashes and suppression keys can still link records.                                                                      | Privacy owner and assigned deletion operators; limited audit summaries to owner.                                         | Approved request/incident procedure from first contact onward.                                                                | Separate bounded administrative policy D24, legally justified minimal residual data. Not an unlimited audit-retention exception.                                                           |
| M8 copies/backups/channel stores      | Verified backups, notebook copies, mail sent/reply folders, scheduling copies, synced devices, temporary exports and reviewer copies of M0-M7.                                                                                             | Inherits the highest identification sensitivity of contents.                                                                                                    | Named copy custodians only; reviewed service processors if used.                                                         | Only approved operational copies; no implicit cloud sync/transcript/AI tooling.                                               | D11: exact inventory, backup expiry/recoverability, deletion obligations, restore-time suppression and proof/limits; no instant physical-purge promise.                                    |

No real study data belongs in the repository, this assistant session, commits,
logs generated here, synthetic fixtures or third-party AI services.
References to M0-M8 are logical IDs, not folders created by this mission.
Consented participation is not permission for arbitrary new analysis or reuse.

## Linkage and auditability

```text
M0 approved stage/configuration -> governs every permitted action/store
M1 contact route <-> slot ID        (separate restricted key)
slot ID -> M2 capture/index -> M3 first-answer notes
M2/M3 -> M5 blinded review -> M6 restricted analysis/release
M4 -> same slot/capture ID          (only if later separately approved)
M7 request scope -> M1/M2/M3/M4/M5/M6/M8 lookup and disposition
M8 copies inherit source-store access, retention and withdrawal duties
```

Slot IDs and capture references must support withdrawal/review lookup without
making the contact key available to analysts. Keep keys long enough for the
approved withdrawal window; do not delete M1 first and then promise linked
response removal. No universal source identity or producer data is involved.

Append-only coding history protects first-answer integrity during lawful
retention; it is not a waiver of approved redaction/deletion. A correction
preserves prior permitted evidence and its reason. A privacy deletion removes
or restricts actual disallowed content across copies and leaves only the
minimal legally justified marker; retained hashes/excerpts need their own
review. A research completion count cannot silently include withdrawn data.

## Retention and withdrawal sequence

1. Before outreach, approve store-specific endpoints and maximum durations,
   notice/withdrawal cutoff, owners, storage/access controls and actual copy
   inventory. Verify intake controls even though collection is not yet allowed.
2. On an authorized request, stop further collection/contact as applicable,
   authenticate proportionately through the approved route, and use M1 to
   locate the slot/capture. Do not demand producer or employer records.
3. Map M2-M6 and all M8 copies. Apply approved withdrawal/redaction/deletion
   to drafts, analyst exports, review excerpts and permitted recordings.
   Recompute restricted aggregates where still linkable; exclude withdrawn
   contributions from gate denominators as required by policy.
4. Record M7 actual actions, accountable operators, remaining backup
   recoverability and applicable lawful limitations. Do not assert physical
   deletion without evidence or preserve sensitive text as "audit".
5. Remove/restrict M1 under its approved endpoint after linked duties can be
   fulfilled. Apply reviewed backup expiry and prevent restored deleted data
   from re-entering active stores; suppression records themselves are governed.
6. After approved irreversible de-identification or publication cutoff,
   explain actual inability/limits to locate contributions and still handle
   remaining identifiable stores/requests. Internal aggregation alone does
   not prove irreversibility.

Exact periods, calendar dates, locations, access names, processors and deletion
methods are **unresolved**, not supplied by this map. Privacy/legal review
must reconcile withdrawal, evidence auditability and any legally required
retention. Do not promise complete instant deletion or lawful basis.

## Operational checks before first intake and first collection

Using synthetic dummy records only, verify separate-key permissions, lookup
across all logical stores, blind review handoff, redaction/deletion and restore
handling, no accidental repository/cloud/AI copies, and logging of actual
limitations. Before collection also verify reference pins, approved consent
mechanics, note fidelity and staff availability. No such infrastructure or
physical deletion proof is claimed to exist today.
