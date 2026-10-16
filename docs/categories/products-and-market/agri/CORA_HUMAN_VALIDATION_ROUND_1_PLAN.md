# Cora Human Validation Round 1 Plan

**Study:** `CORA_HUMAN_VALIDATION_ROUND_1`
**Study version:** `cora-human-validation-round-1-v1.0`
**Date:** 2026-10-10
**Preparation disposition:** `CORA_HUMAN_VALIDATION_ROUND_1_READY_FOR_AUTHORIZATION`

Preparation only. No contact, invitations, recruitment or scheduling authorized.
No human evidence exists. The twelve-person sample and thresholds are accepted
in principle as local formative gates, not population statistics or product
benchmarks. Consent/privacy, personnel and outreach decisions remain open.

## Purpose and accepted baseline

Test comprehension of evidence, provider/issuer authority, institutional
decision ownership, currentness, reuse, revocation/history, terminology and
navigation in the existing synthetic reference.

Do not test demand, willingness to pay, institutional adoption, legal
acceptance, production usability, interoperability or provider integration.
Participation is personal research participation, not employer endorsement.
No real producer/institutional evidence, credentials or source access.
Deere, FieldView and Organic Alpha gates remain unchanged.

This operational pack implements, rather than redesigns, the accepted
[protocol](CORA_HUMAN_COMPREHENSION_VALIDATION_PROTOCOL.md),
[rubric](CORA_HUMAN_COMPREHENSION_RUBRIC.md),
[capture guide](CORA_HUMAN_VALIDATION_CAPTURE_SCHEMA.md) and
[session guide](CORA_SYNTHETIC_VALIDATION_SESSION_GUIDE.md).
The [manifest](CORA_HUMAN_VALIDATION_ROUND_1_MANIFEST.json) freezes the
instrument versions/digests. No runtime or UX changes are made.

Decision-only supplements:
[authorization decision pack](CORA_HUMAN_VALIDATION_AUTHORIZATION_DECISION_PACK.md),
[operating model recommendation](CORA_HUMAN_VALIDATION_OPERATING_MODEL_RECOMMENDATION.md),
[consent decision register](CORA_HUMAN_VALIDATION_CONSENT_DECISION_REGISTER.md) and
[bounded data map](CORA_HUMAN_VALIDATION_DATA_MAP.md).

## Eligibility and allocation

All candidates must voluntarily participate, understand the study language,
and be able to explain their own interpretation with reasonable accessibility
accommodations. Do not require APIs, IT, Cora or certification expertise.
Do not collect employer names, farm records or sensitive proof of experience;
a short category-level self-description is sufficient for screening.

| Persona                         | Inclusion                                                                                                                | Exclusion / separate flag                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Producer/operator               | Actual farm/agri-food operational involvement or operational/business decisions.                                         | IT-only expertise without operational involvement is insufficient.                                  |
| Adviser/service provider        | Agronomy, consulting, accounting, veterinary, crop-specialist or analogous work interpreting/using producer evidence.    | Generic software advice alone is insufficient.                                                      |
| Certifier/program administrator | Practical certification, assurance, standards, compliance, funding/program or evidence-based eligibility administration. | Abstract technical familiarity without workflow experience is insufficient.                         |
| Institutional recipient         | Uses evidence to make/support procurement, finance, risk, assurance, eligibility or policy/program decisions.            | Software/IT experience alone is insufficient; no representative institutional commitment requested. |

Global exclusion/flags:

- Exclude Nzila/Cora implementers, current UX designers and deeply
  Cora-trained/answer-key-exposed people from the first-exposure cohort.
- One person per slot. Multi-role candidates receive one primary role;
  no duplicate across slots without explicit justification and authorization,
  and duplicates cannot count as independent participants for the gate.
- Exclude strong moderator dependency/response-pressure relationships
  (direct reports, assessed students, dependent clients); use another moderator
  or recruitment source before accepting a candidate.
- Do not confuse disability or assistive technology with lack of independence.
  Provide accommodations. If accommodation requires teaching the answers,
  flag the instrument/access barrier and arrange an appropriate retest, not
  a low comprehension score attributed to the participant.
- Record excluded/replaced anonymous slot, reason, who approved replacement
  and cohort/order; never silently substitute or select only high scorers.

## Anonymous participant matrix

All rows are planned, not recruited. Review role codes below are unstaffed:
`R1` initial analyst, `R2` independent reviewer, `R3` adjudicator.
Actual distinct-person assignment needs authorization.
Candidate/contact mapping must remain outside repository/analysis files.

| Slot | Planned persona                 | Eligibility  | Recruitment source | Conflict/bias | Status              | Consent       | Session       | Planned reviewers |
| ---- | ------------------------------- | ------------ | ------------------ | ------------- | ------------------- | ------------- | ------------- | ----------------- |
| P01  | Producer/operator               | Not assessed | Unselected         | Not assessed  | PLANNED_UNCONTACTED | NOT_REQUESTED | NOT_SCHEDULED | R1 / R2           |
| P02  | Producer/operator               | Not assessed | Unselected         | Not assessed  | PLANNED_UNCONTACTED | NOT_REQUESTED | NOT_SCHEDULED | R1 / R2           |
| P03  | Producer/operator               | Not assessed | Unselected         | Not assessed  | PLANNED_UNCONTACTED | NOT_REQUESTED | NOT_SCHEDULED | R1 / R2           |
| P04  | Adviser/service provider        | Not assessed | Unselected         | Not assessed  | PLANNED_UNCONTACTED | NOT_REQUESTED | NOT_SCHEDULED | R1 / R2           |
| P05  | Adviser/service provider        | Not assessed | Unselected         | Not assessed  | PLANNED_UNCONTACTED | NOT_REQUESTED | NOT_SCHEDULED | R1 / R2           |
| P06  | Adviser/service provider        | Not assessed | Unselected         | Not assessed  | PLANNED_UNCONTACTED | NOT_REQUESTED | NOT_SCHEDULED | R1 / R2           |
| P07  | Certifier/program administrator | Not assessed | Unselected         | Not assessed  | PLANNED_UNCONTACTED | NOT_REQUESTED | NOT_SCHEDULED | R1 / R2           |
| P08  | Certifier/program administrator | Not assessed | Unselected         | Not assessed  | PLANNED_UNCONTACTED | NOT_REQUESTED | NOT_SCHEDULED | R1 / R2           |
| P09  | Certifier/program administrator | Not assessed | Unselected         | Not assessed  | PLANNED_UNCONTACTED | NOT_REQUESTED | NOT_SCHEDULED | R1 / R2           |
| P10  | Institutional recipient         | Not assessed | Unselected         | Not assessed  | PLANNED_UNCONTACTED | NOT_REQUESTED | NOT_SCHEDULED | R1 / R2           |
| P11  | Institutional recipient         | Not assessed | Unselected         | Not assessed  | PLANNED_UNCONTACTED | NOT_REQUESTED | NOT_SCHEDULED | R1 / R2           |
| P12  | Institutional recipient         | Not assessed | Unselected         | Not assessed  | PLANNED_UNCONTACTED | NOT_REQUESTED | NOT_SCHEDULED | R1 / R2           |

The manifest contains these same twelve rows and counterbalanced orders.
Its preparation metadata may be registered; do not later replace it with
participant/contact records. Maintain actual progress in approved local
research storage using slot IDs and an append-only change log.

## Burden evaluation without reducing coverage

Every participant retains all **61 responses / 122 points**, seven core
scenarios plus stale/expired probes. Roles do not receive easier question sets.

| Option                            | Burden estimate (planning, not observed)                                                                                           | Decision                                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Full protocol, uninterrupted      | 61 tasks at 45-60 seconds each = about 46-61 minutes; orientation, confidence/probes, term review/debrief add about 15-25 minutes. | Do not require uninterrupted administration. Fatigue risk; 90 minutes is a reservation, not guaranteed duration. |
| Core plus role-specific branching | Fewer repeated tasks, but different coverage/denominators.                                                                         | Not selected: changes accepted protocol and could omit guardrails. Requires separate design authorization.       |
| Full protocol with breaks/staging | Two roughly 35-40 minute work blocks with a break, or two separately arranged 45-minute sittings with same digest/order.           | Recommended minimum-burden compliant option; preserve all baseline tasks.                                        |

Offer **up to 90 minutes with breaks, optionally two 45-minute sittings**.
Do not schedule now. At 120 active seconds per question offer continue/skip;
if many tasks approach that bound the protocol can exceed 90 minutes. Pause,
ask about burden and offer another sitting under the same consent/version.
Do not truncate or score missing tasks as correct to fit a booking.

Split after the fourth assigned core scenario, not after a fixed question
count (counterbalanced orders have unequal block lengths). Finish remaining
three, then both freshness probes. No debrief, teaching or answer-key exposure
between blocks. Record block times, actual scenario order and outside
exposure; one person across two sittings is one session/denominator.
First authorized session calibrates burden; a material change requires
documented amendment before the next participant, not retroactive scoring.
All estimates are design judgments without human timing evidence.

## Instruments, blanks and data separation

Six readiness documents:
[moderator script](CORA_HUMAN_VALIDATION_MODERATOR_SCRIPT.md),
[consent/data draft](CORA_HUMAN_VALIDATION_CONSENT_DATA_HANDLING_DRAFT.md),
[session QA](CORA_HUMAN_VALIDATION_SESSION_QA_CONTRACT.md),
[analysis specification](CORA_HUMAN_VALIDATION_ANALYSIS_SPEC.md),
[outreach drafts](CORA_HUMAN_VALIDATION_OUTREACH_DRAFTS.md) and this plan.

[P01-P12 blanks](human-validation-round-1/) are metadata-only
`PRE_RECRUITMENT_TEMPLATE` instances of schema artifact 1.1.
No consent, authorization, answers, score placeholders, timing or exposure
assumptions are fabricated. The structural kind and `humanEvidence: false`
prevent an empty fixture being mistaken for a session.

Accepted 1.0 completed/dry-run validation is preserved. Future authorized
human captures use the original 1.0 `HUMAN_SESSION` branch, in approved
research storage, with actual consent and authorization references.
The external study index links capture ID, participant slot, study/reference
version, QA and review logs. No runtime ingestion or analytics dashboard added.

## Stop, gate and change management

Follow [QA contract](CORA_HUMAN_VALIDATION_SESSION_QA_CONTRACT.md):
same critical misconception in two independent participants pauses the round;
reference defects, leading moderation, material capture loss or misleading
synthetic scenarios stop collection before filling the quota.
One critical finding blocks advancement and triggers immediate review even
before the two-person round-pause threshold.

Approved local gate: at least 85% per participant/persona, every guardrail
response 2, zero critical flags in the qualifying cohort, no unresolved
critical/high findings or score disputes, persona mean gap at most 10 points,
and **12 independently valid complete sessions, three per persona**, without
unresolved protocol defects. Timing-only limitations may be documented if
comprehension remains valid; they cannot support timed-performance claims.
Invalid/incomplete sessions require explicit replacement/retest plans.

Critical/high fixes require original failed scenario, one unaffected scenario
and at least one different persona. Freeze old cohort/version; no pooled
pre/post scores or overwritten first answers. New cohort must meet its own
coverage/gates; old findings remain historical. Passing informs only an
explicit decision about next bounded work, never live/production use.

## Authorizations needed before recruitment

Aubert must explicitly approve:

1. Which recruitment sources and first persona/slot to approach, and whether
   to authorize Round 1 outreach at all; no candidate selected here.
2. Final invitation/info/scheduling/reminder/thank-you wording, senders,
   contact channels, contact limits and any compensation decision.
3. Final consent/privacy/legal handling: lawful basis/jurisdiction as reviewed,
   approved location, access holders, retention/deletion dates, withdrawal
   cutoff, optional recording/screenshare and quote use. No legal approval
   invented; review unresolved placeholders before use.
4. Actual moderator, observer, R1/R2/R3 assignments, independence/conflict
   screening and nonparticipant rehearsal; no personnel assignments implied.
5. Session logistics, accessible format, burden/staging and authority to
   schedule/collect data only after voluntary informed consent.
6. Any subsequent UX/protocol revision, cohort restart or expansion outside
   this approved-in-principle formative scope.

Preparation review can be authorized separately from recruitment. The active
request authorizes none of contact, booking, human capture or live source work.
