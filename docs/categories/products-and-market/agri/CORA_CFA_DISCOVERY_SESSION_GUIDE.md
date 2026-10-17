# Cora CFA Discovery Session Guide

**Version:** `cora-cfa-discovery-1.0`
**Date:** 2026-10-14
**Purpose:** Gate B1 execution preparation only; no meeting/contact authorized.
**Intended interlocutors:** Keith Currie and Scott Ross, as specified by Aubert.
No participation, availability, role mandate or agreement is established.

## Aubert's facilitator view - 45 minutes

Use the workbook below as the primary structured record during a later,
separately authorized conversation. The
[JSON template](CORA_CFA_DISCOVERY_CAPTURE_TEMPLATE.json) supplies empty
registries and copyable entry shapes; the
[schema](CORA_CFA_DISCOVERY_CAPTURE.schema.json) preserves unknowns and
separates claims, candidates, recipients, producers and verification.
Do not try to complete every field while speaking. Capture the core claim
and concrete example directly into its row; leave unanswered fields null,
then clarify material gaps at the close or in authorized follow-up.
Loose notes may supplement, never replace, these claim-linked rows.

**Opening, read naturally:**

> We are exploring whether agricultural evidence handoffs create a problem
> worth solving, and where existing verification already works well.
> Organic is one candidate, not a conclusion. We would value a different
> example grounded in producer experience, and who makes the receiving decision.
> This is discovery, not a request for endorsement, partnership or a pilot.
> We are not asking for producer files, private records or introductions today.
> We will distinguish your experience from points that need source or
> institutional verification. Please challenge the premise.

Before any later session, confirm separately approved purpose, participants,
note-taking, storage/access, handling/retention and authority to conduct it.
No recording, transcription, screenshots, AI assistant or third-party
research tooling is authorized by this pack. If authorized notes cannot be
captured reliably, pause rather than invent or silently record.

| Minutes | Topic                              | Primary questions / short probes                                                                                                                                                                                                                                             | Structured output                                                                                 |
| ------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 0-4     | Frame and experience               | What part of this have you seen directly? Are you describing a specific case, institutional knowledge or a hypothesis?                                                                                                                                                       | Session source and claim-type/basis, not assumed institutional mandate.                           |
| 4-13    | Challenge Organic                  | Is repeated organic proof a material burden? Who requests it, how often, for what decision? Retrieval, current-status check, re-entry or another task? What do recipients trust: directory, certificate or portal? What already works? Where would portability add no value? | A claims, workflow steps, direct-source baseline and possible negative finding.                   |
| 13-25   | Find a different handoff           | Outside Organic, walk through a recent evidence request. Who originated it, who holds it, who receives it, and what decision depends on it? What must the producer repeat? Which verification is legitimate and which looks avoidable?                                       | B candidate rows and step-level claims; no selection made in the meeting.                         |
| 25-33   | Test receiver change and authority | Who could describe the recipient's process? With trusted provenance, scope, temporal state and valid authority, which step could they skip, substitute, narrow or accelerate? Which must remain? Who governs access and liability?                                           | Provisional recipient row, draft behavioural hypothesis and explicit authority questions.         |
| 33-40   | Producer value and readiness       | What concrete time/cost/frequency example supports the burden? What risk, optionality, switching, market access or delay changes? Where is the evidence now: system, spreadsheet, document, email, adviser or paper? Would digitization add work?                            | B measurements with basis; ten net-value dimensions; readiness and separate capture prerequisite. |
| 40-45   | Recap and gaps                     | Have we represented your claims accurately? Which are uncertain or second-hand? Is there a plausible different handoff and receiver for each route? What would falsify it? Who could verify each gap?                                                                        | Correction/verification queue and provisional discovery disposition, not permission.              |

If time is short, preserve one fully traced concrete handoff rather than
several vague ideas. Stop at 45 minutes or ask about a separately authorized
follow-up; do not book it here. An unanswered question is a gap, not agreement.
No implied third-party contact permission. A referral/introduction offer is
captured as an offer only, with separate authorization still required.

## Fast structured workbook

Create a working copy outside the repository only after session authorization.
Use pseudonymous speaker refs S1/S2 and producer refs P1/P2; the contact key,
if necessary and approved, is separate. The intended names above are not
proof of attendance or authority. Session ID, actual speakers/role contexts
and actual times are filled only when evidenced. Every row uses stable IDs.

### 1. Claim rows - capture during dialogue

| claimId | speaker ref / role context | type / basis | A, B or cross-route / step | claim (quote or labelled paraphrase) | concrete example / burden basis | confidence / verify? | recipient/institution role / impact | authority / verification question | follow-up owner / needed | session / time |
| ------- | -------------------------- | ------------ | -------------------------- | ------------------------------------ | ------------------------------- | -------------------- | ----------------------------------- | --------------------------------- | ------------------------ | -------------- |
|         |                            |              |                            |                                      |                                 |                      |                                     |                                   |                          |                |

Types: DIRECT_EXPERIENCE, OBSERVED_EXAMPLE, INSTITUTIONAL_KNOWLEDGE,
OPINION, HYPOTHESIS, REFERRAL, DOCUMENTARY_EVIDENCE.
`claimType` identifies the kind of claim; `evidenceBasis` explains how it is
known, including source/period/method and first-hand versus reported status.
`confidence` records the speaker's explicit HIGH/MEDIUM/LOW/UNKNOWN statement,
not a calculated credibility or legal-truth score. Unknown confidence stays
UNKNOWN. `needsVerification` is separate; opinion is not documentary proof.
Quotes require approved handling; otherwise label faithful paraphrase.
Do not reconstruct a quote from memory.

### 2. Workflow-step rows - one per handoff/verification action

| stepId / candidate or A | actor / source / subject / recipient | requested evidence / transfer / recipient decision | current verification / reason | provisional friction class / supporting claim IDs | frequency / time / cost and basis | baseline method / remaining gaps |
| ----------------------- | ------------------------------------ | -------------------------------------------------- | ----------------------------- | ------------------------------------------------- | --------------------------------- | -------------------------------- |
|                         |                                      |                                                    |                               |                                                   |                                   |                                  |

Classify provisionally as PURE_FRICTION_CANDIDATE, CURRENCY_CHECK,
MANDATED_VERIFICATION, INDEPENDENT_JUDGMENT, INSTITUTIONAL_RISK_PRACTICE,
CONTRACTUAL_REQUIREMENT or UNKNOWN_PENDING_VERIFICATION.
If several obligations are mixed, split steps or preserve the dominant
provisional class plus explicit unresolved obligations. A participant cannot
settle legal/regulatory/audit classification by assertion; Phase 0 verifies it.

### 3. B candidate rows - link, do not select

| candidateId / claim IDs | commodity/context / producer type / different from Organic? | origin / holder / evidence | recipient / decision / transfer | repeated action / verification reason | frequency / elapsed / producer time / cost / decision delay | access consequence / readiness / sensitivity | draft receiver change / shadow recipient | criterion gaps / authority questions |
| ----------------------- | ----------------------------------------------------------- | -------------------------- | ------------------------------- | ------------------------------------- | ----------------------------------------------------------- | -------------------------------------------- | ---------------------------------------- | ------------------------------------ |
|                         |                                                             |                            |                                 |                                       |                                                             |                                              |                                          |                                      |

Copy the full `entryTemplates.handoffBCandidate` shape for details after
conversation. Each numeric measure needs value/unit, sample/time period and
claim-basis IDs. No calculation from phrases like "always" or "a lot".
Unknown measurements stay null with UNKNOWN_TO_BE_BASELINED.
Preserve legal/regulatory, audit, contract, independent-judgment and
habitual/manual obligations separately, even when all are unknown.

### 4. Provisional people/institution registries

| recipientId / claim IDs | institution / A or B | function / decision / requested evidence | verification method / reason | draft behavioural delta | authority to participate / relationship source | status / contact authority reference |
| ----------------------- | -------------------- | ---------------------------------------- | ---------------------------- | ----------------------- | ---------------------------------------------- | ------------------------------------ | --- |
|                         |                      |                                          |                              |                         |                                                |                                      |     |

| producerRef / claim IDs | commodity/context / candidate route | readiness / relevant experience | referral source / interest | compensation expectation / ethics needs | contact authority / status |
| ----------------------- | ----------------------------------- | ------------------------------- | -------------------------- | --------------------------------------- | -------------------------- | --- |
|                         |                                     |                                 |                            |                                         |                            |     |

Recipients: MENTIONED, CANDIDATE, INTRODUCTION_OFFERED, CONTACT_AUTHORIZED,
DECLINED or NOT_VERIFIED. CONTACT_AUTHORIZED requires a distinct actual
authorization reference, date and scope; a claim/referral alone cannot set it.
Producers use a separate registry and pseudonymous refs, with no name,
phone, email, address or employer fields. Participation interest is unknown
unless supported; it is not consent, eligibility or contact authority.
Contact route in recipient rows is only an evidenced institutional channel
reference, never a scraped personal address. Do not research one in this task.

### 5. Verification queue - populate from claim IDs

| verificationId / claim IDs | category | what must be checked / proposed authoritative source | status / evidence reference | owner / authorized follow-up? |
| -------------------------- | -------- | ---------------------------------------------------- | --------------------------- | ----------------------------- |
|                            |          |                                                      |                             |                               |

Categories: regulatory claim, program requirement, standard, contractual
practice, recipient verification policy, burden estimate, market-access
consequence or institutional process. States: VERIFIED, UNVERIFIED,
NOT_PUBLICLY_VERIFIABLE or REQUIRES_INSTITUTION_CONFIRMATION.
VERIFIED needs actual supporting source, scope, date and verifier; an interview
quote alone does not verify an external requirement.
NOT_PUBLICLY_VERIFIABLE requires a reason and retains the uncertainty.
No contact/search/verification work is authorized merely by assigning a queue item.

## Organic challenge and best legitimate baseline

Organic remains A, not presumed success. Originator issues/publishes;
evidence concerns an operator; Cora supports provenance/composition;
recipient decides. Do not require an operator transmission intermediary.
For each A step ask:

- What exact requirement, requester and decision period apply?
- How often is proof requested, and what work is actually repeated?
- Is the certificate itself required, or does direct certifier directory
  verification suffice? Which current portal/validation/export/process works?
- Which check is currentness, legal/audit/contractual duty or professional judgement?
- What change would the recipient actually make, and which checks remain?
- Where does portability not reduce burden, risk, latency or coordination?

Record `DIRECT_SOURCE_BASELINE_SUFFICIENT` as SUPPORTED, CHALLENGED or
UNKNOWN with claim IDs. SUPPORTED is a discovery signal, not a verified Phase 0
finding; it can trigger ORGANIC_ROUTE_REASSESSMENT. Preserve concrete adverse
claims and contradictions; do not rewrite them as opportunities.
Organic source inquiry remains separate, unsent and rights-gated:
[source decision](CORA_ORGANIC_FIRST_LIVE_SOURCE_DECISION.md) and
[source-access record](CORA_ORGANIC_SOURCE_ACCESS_DECISION_RECORD.md).

## Candidate B authority backlog and draft hypotheses

For every candidate retain an explicit question and UNKNOWN answer until
evidenced for each of: evidence origin; access governance; whether consent
actually applies; instruction; contract; institutional mandate; legal/
regulatory basis; recipient's independent duties; wrong/stale evidence
liability; evidence that cannot legitimately be reused.
`ACCESS_PREFERENCE` cannot replace upstream authority.

Draft each recipient hypothesis in the recipient row, labelled
`THRESHOLD_STATUS = DRAFT_DISCOVERY_ONLY`:
"If trustworthy portable evidence with provenance, scope, temporal state
and valid access authority is presented, the recipient could reduce [named
legitimate step] by [skip/substitute/narrow/accelerate/less evidence or follow-up]."
Unproven currentness must remain visibly unknown; portable is not current.
No metrics/pass/redirect/kill thresholds are approved by this wording.

Each route's net-value draft preserves producer time, direct cost,
administrative burden, risk, optionality, switching ability, market access,
decision latency, privacy exposure and liability exposure. No cash-only total
or invented weighting. Default UNKNOWN_TO_BE_BASELINED; an attributed
estimate requires a concrete basis, unit, sample and period.

Readiness: STRUCTURED_SYSTEM_DATA, SPREADSHEET_DATABASE, PDF_DOCUMENT, EMAIL,
ADVISOR_HELD, PAPER, MIXED or UNKNOWN. If capture/digitization is prerequisite,
set CAPTURE_WORKSTREAM_CANDIDATE = YES with supporting claim IDs, otherwise
NO only with evidence, or UNKNOWN. Its burden is separate from portability.
Do not filter candidates to digitally convenient cases.

## Availability, authoritative state and safe handoff

`NLI_CFA_Discovery_Brief_v3_Oct2026` and
`CORA_Stress_Test_Playbook_v3_Oct2026` were not found in the inspected
repository/session files. AVAILABILITY = NOT_AVAILABLE_IN_INSPECTED_REPO_SESSION.
No line-by-line synchronization claimed. The accepted repository
[doctrine](ADR/ADR-AGRI-002-cora-food-economy-ceiling.md) and
[framework](CORA_STRESS_TEST_FRAMEWORK.md) bind this package.

```text
CORA_STRESS_TEST_REPO_SYNC = PASS
GATE_A_DOCTRINE_CONSISTENCY = CLOSED
GATE_B_BEACHHEAD_CONSISTENCY = IN_PROGRESS
HANDOFF_A = CANADA_ORGANIC_EVIDENCE
HANDOFF_B = PENDING_CFA_SELECTION
GATE_C_EXECUTION = NOT_AUTHORIZED
CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION
PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN
PRODUCTION_ACTIVATION = BLOCKED_STRESS_TEST
COMMERCIAL_PILOT_COMMITMENT = BLOCKED_STRESS_TEST
```

After a later authorized meeting, follow the
[post-session decision contract](CORA_CFA_DISCOVERY_POST_SESSION_DECISION.md).
The package itself supplies zero session findings, candidates or participants.
Keep original claim versions/corrections, basis, speaker context, source
session/time and verification gaps. Working captures with real statements,
referrals or participant details belong in separately approved restricted
storage, not git, this assistant session or external AI services.
Return only an approved minimized/redacted evidence summary for later
Gate B3 ingestion; do not paste unapproved personal or confidential records.

**Next human action:** Aubert separately authorizes the actual CFA
conversation and its bounded note handling with the intended interlocutors.
Only after it occurs should evidence populate B/receivers and support a
Gate B closing decision. No messages, calendar events, third-party contact,
Pro-Cert inquiry, Gate C execution or live collection under this mission.
