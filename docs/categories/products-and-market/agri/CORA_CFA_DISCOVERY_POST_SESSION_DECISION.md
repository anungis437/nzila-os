# Cora CFA Discovery Post-Session Decision Contract

**Version:** `cora-cfa-decision-1.0`
**Date:** 2026-10-14
**Status:** rules and blank outcomes only; no session conducted.

Use the [guide](CORA_CFA_DISCOVERY_SESSION_GUIDE.md),
[capture schema](CORA_CFA_DISCOVERY_CAPTURE.schema.json) and
[empty template](CORA_CFA_DISCOVERY_CAPTURE_TEMPLATE.json).
This is a manual evidence-backed decision contract, not a runtime gate.
No doctrine, stress-test threshold, source right or actual B selection changes.

## Preconditions and evidence integrity

Do not produce a post-session outcome for an unheld, unauthorized or
materially incomplete/unreliable session. Record NOT_ASSESSED with reasons,
and action NONE_AUTHORIZED. A blank template is not NOT_IDENTIFIED evidence.
Check actual authorization/session times, claim attribution/type/basis,
unique IDs, valid links and missing/corrected claims first.
The JSON Schema checks shapes, frozen states and basic outcome prerequisites.
It does not prove truth, authorization authenticity, cross-record references
or substantive credibility. Before decision, manually verify unique claim,
step, candidate, recipient, producer and queue IDs; speaker/session/time
bindings; every claim/basis reference; candidate-to-step/shadow-recipient
links; correction-to-original links; and post-session candidate/evidence
links. No decision is valid with a dangling or unsupported reference.
Use a Draft 7 validator with date-time format assertions enabled; a validator
that ignores formats is insufficient. Do not confuse a structural pass with
verified evidence or executable authorization.
Preserve contradictory accounts independently; do not average authority
opinions into a legal finding. Speaker confidence and factual verification
remain distinct. Referrals are not participation/contact authorization.

Externally verifiable statements enter the queue as UNVERIFIED or
REQUIRES_INSTITUTION_CONFIRMATION unless actually verified with scoped
authoritative evidence and verifier/date. A nonpublic practice is not
false or true by default: retain NOT_PUBLICLY_VERIFIABLE with reason.
All legal/regulatory/audit/contractual interpretations remain provisional
until qualified Phase 0 review; interview authority cannot settle them.

## Candidate B eligibility - transparent discovery criteria

Assess each criterion MET, NOT_MET or UNKNOWN using named claim IDs and
specific rationale. No numerical convenience score or digitally ready bonus.
MET means supported enough for a discovery candidate, not independently
verified or authorized to test.

| Criterion ID                 | Required support to mark MET                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| producerBurden               | Producer-recognized concrete repeated action, supported example and measurable burden basis (not an invented number).                     |
| handoffIdentifiable          | Evidence, origin/current holder, transfer and producer action can be traced.                                                              |
| recipientIdentifiable        | Plausible recipient institution/function and the evidence it requests.                                                                    |
| decisionConsequence          | Actual decision type and described producer/market/access consequence.                                                                    |
| differentFromOrganic         | Commodity or institutional setting meaningfully different from A; state how.                                                              |
| measurableFriction           | Proposed observable producer/institutional re-entry measure, frequency/time/cost basis or explicit baseline plan grounded in the example. |
| verificationCulture          | Described real verification method/reason; classification still provisional.                                                              |
| authorityQuestionsIdentified | Ten explicit origin/access/basis/independent-duty/liability/nonreuse questions with unknowns preserved.                                   |
| shadowParticipantsPlausible  | Identified provisional recipient and separate producer class/referral route with relevant experience; no presumed contact/consent.        |

A credible B candidate requires **all nine MET**, each with claim references
and rationale, and no unresolved contradiction defeating those supports.
UNKNOWN/NOT_MET cannot be silently promoted. A useful but incomplete lead
remains a lead for more discovery, not a credible B.
No need to invent precise burden values to be credible: measurable examples
and an explicit baseline gap are acceptable; their numerical impact stays
UNKNOWN_TO_BE_BASELINED until observed.

If multiple credible candidates exist, report MULTIPLE_CANDIDATES rather
than invent selection. Rank by documented discovery criteria only:
stronger concrete burden/handoff/decision support, recipient/producer
plausibility, then fewer material uncertainties. Use an explicit per-criterion
evidence comparison with limitations; tied/incomparable candidates remain
tied/unranked. Record owner/rationale. Rankings are discovery prioritization,
not approval, and digital convenience is never a deciding criterion.

## Independent discovery-state rules

Apply only after a sufficiently reliable actual session record is reviewed.

| Condition                       | HANDOFF_B_DISCOVERY  | B state in the discovery record                   |
| ------------------------------- | -------------------- | ------------------------------------------------- |
| Exactly one credible candidate  | CANDIDATE_IDENTIFIED | PENDING_VALIDATION                                |
| Two or more credible candidates | MULTIPLE_CANDIDATES  | PENDING_VALIDATION; no winning candidate implied. |
| No credible candidate           | NOT_IDENTIFIED       | PENDING_CFA_SELECTION; preserve incomplete leads. |

PENDING_VALIDATION is the discovery-record state only. The canonical
[stress registry](CORA_STRESS_TEST_REGISTRY.json) stays PENDING_CFA_SELECTION
until later authorized Gate B3 review verifies facts, current workflow,
authority and candidate selection. No registry update in this mission.

For A, record HANDOFF_A_DISCOVERY_CHALLENGE as UNASSESSED, NONE_RECORDED
or MATERIAL_CHALLENGE_RECORDED plus explicit finding and supporting claim IDs.
NONE_RECORDED means no material challenge captured, **not A validated**.
Capture whether direct-source baseline sufficiency is SUPPORTED, CHALLENGED
or UNKNOWN, with claims/reason. SUPPORTED or another material adverse finding
requires MATERIAL_CHALLENGE_RECORDED. Do not suppress a negative Organic
finding because B is promising. If A was not examined, UNASSESSED remains.

## Deterministic next-step disposition - ordered rules

The reviewer records the evidence inputs, their gaps, actual date/owner and
proposed state. Apply the first matching rule; retain all secondary route
findings, even where one determines the primary disposition.

| Priority | Evidence-backed condition                                                                                                                                                                                                                                                                                | Primary discovery disposition       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 0        | No authorized actual/reliable session, unresolved material record defect, or unassessed decision inputs.                                                                                                                                                                                                 | NOT_ASSESSED; not a meeting result. |
| 1        | Substantiated discovery evidence of no justified intervention across A and all explored B contexts, or a decisive unmitigated cross-route authority/ethics barrier, **and explicit accountable human no-go decision**. An absence of candidates alone does not qualify.                                  | STRESS_TEST_NO_GO                   |
| 2        | A has a material challenge, including discovery support for DIRECT_SOURCE_BASELINE_SUFFICIENT.                                                                                                                                                                                                           | ORGANIC_ROUTE_REASSESSMENT          |
| 3        | No credible B candidate exists after the session.                                                                                                                                                                                                                                                        | HANDOFF_B_NOT_IDENTIFIED            |
| 4        | Multiple credible Bs with unresolved priority/selection, unverified current-workflow/recipient/burden claims essential to choosing one, unavailable plausible receiver for either route, a substantive no-go finding awaiting accountable review, or material uncertainty preventing scoped preparation. | MORE_DISCOVERY_REQUIRED             |
| 5        | One credible B, plausible provisional receiver for each route, concrete workflow/burden support, explicit authority/verification backlog and scoped Phase 0 plan; no defeating material uncertainty, no A challenge or no-go finding.                                                                    | PROCEED_TO_PHASE_0_PREPARATION      |
| 6        | Any other evaluated combination or unresolved conflict.                                                                                                                                                                                                                                                  | MORE_DISCOVERY_REQUIRED             |

"Enough evidence" is not an unsupported confidence judgment: Rule 5 requires
all its inputs with claim IDs and review rationale. Some legal/source-right
answers can remain unresolved because Phase 0 preparation is expressly to
verify them; they cannot become Phase 0 PASS or actual testing permission.
Rule 4's essential gaps must be identified, not selectively hidden.
Multiple candidates without a documented, separately reviewed priority
decision do not qualify for Rule 5.

The five actual discovery dispositions do not grant Gate C, a commercial
pilot, production activation or source access. PROCEED_TO_PHASE_0_PREPARATION
is a recommendation to prepare, not authority to contact third parties.
STRESS_TEST_NO_GO is not automatically the stress framework's portfolio
NO_GO; that requires its separate complete evidence/decision contract.

## Verification queue and authority follow-up

Each external claim can link one or several category-specific queue items.
Capture question, claim IDs, proposed authoritative source/method, status,
evidence reference/scope, verifier/date or reason for inability, follow-up
owner and action-authorization reference. Interview basis stays in the claim;
later verification is an additional record, not a rewritten interview.

Per B candidate retain these ten question IDs:
ORIGINATOR, ACCESS_GOVERNANCE, CONSENT_RELEVANCE, INSTRUCTION,
CONTRACTUAL_AUTHORITY, INSTITUTIONAL_MANDATE, LEGAL_REGULATORY_BASIS,
RECIPIENT_INDEPENDENT_VERIFICATION, WRONG_STALE_LIABILITY, NON_REUSABLE_EVIDENCE.
A claim-supported proposed answer is not legal resolution. Show Phase 0
authority/source-right questions separately from observational burden gaps.

## Handoff to later Gate B3

1. Store original structured capture under separately approved access/
   retention, with append-only corrections subject to lawful deletion handling.
2. Prepare an approved minimized/redacted summary with claim/evidence
   references, provisional A/B findings, recipient/producer classes, best
   current workflows, ten net-value dimensions, readiness and capture burden.
3. Review verification queue and remaining uncertainty; decide who may
   perform each follow-up, including whether any institutional contact is
   separately authorized. No name mentioned implies permission.
4. Aubert makes the explicit Gate B continuation/closing decision. Only later
   authorized evidence ingestion can select/update B, source records or
   preregister real thresholds. Preserve original discovery versions.
5. Keep HANDOFF_B = PENDING_CFA_SELECTION and GATE_C_EXECUTION =
   NOT_AUTHORIZED until the appropriate independent decision is on file.

Current outcome fields are null/NOT_ASSESSED; claims/candidates/registries/
verification queue are empty. No CFA endorsement, partnership, receiver
acceptance, producer participation, source rights, interview findings or
friction percentage is established by this document.
