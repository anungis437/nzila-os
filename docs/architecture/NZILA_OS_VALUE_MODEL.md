# NzilaOS Value Model - Target Contract

Checkpoint 2, 2026-10-12, design only. Inherits scoped sources, internal-human
accountability, audit/retention and failures from the
[operating model](./NZILA_OS_INSTITUTIONAL_OPERATING_MODEL.md).
Evidence-backed authorized realization is `[Validated: user]`; target mechanics
and compatibility below are `[Design]`.

## Outcome and boundary

Connect institutional work to forecast, observed and accepted outcomes without
turning a successful run, green status, saved scoreback or agent calculation into
realized benefit. No new finance ledger, investment executor or value package.

## Sources and contract

The benefit source is a bounded institutional-intelligence module with scoped
durable DB adapter. Internal outcome steward owns semantics; internal human
outcome owner is accountable for each record. Consumers: Missions, decision
review, existing executive/CAPITAL projections and Console Portfolio.

Existing [decisionScorebacks](../../packages/db/src/schema/executive.ts) retain
expected/actual result/ROI and pending/on-track/exceeded/missed/cancelled semantics.
CAPITAL signals retain live/manual/estimate/unavailable provenance and nullable
values. Neither is evidence of authorized institutional realization.

```text
Benefit {
  id, scope, title, outcomeOwnerAssignmentRef,
  missionRefs[], estateRefs[], changeRefs[], decisionRefs[],
  type: FINANCIAL | SERVICE | RISK_REDUCTION | CAPACITY | CONTINUITY | OTHER,
  outcomeDefinition, beneficiaryRefs[], baselineRef?, metric, unit,
  measurementWindow, methodVersion, sourceRefs[], forecast,
  realizationCriteria, reviewAt?, attributionMethod,
  status: FORECAST | OBSERVED | REALIZED | REJECTED | UNPROVEN,
  version, createdBy, source, evidenceRefs[], reassessmentRefs[]
}
BenefitObservation {
  id, scope, benefitRevisionRef, observationTime, window, sourceRefs[],
  value: number | structured-result | null, unit, methodVersion,
  knowledge: OBSERVED | DECLARED | ESTIMATED | UNKNOWN,
  uncertainty, baselineRevisionRef?, exclusions, confounders,
  producedBy, actorClassification, evidenceRefs[], immutableHash
}
BenefitAcceptance {
  id, scope, benefitRevisionRef, observationRevisionRefs[], criteriaVersion,
  internalAcceptorId, outcome: ACCEPTED | REJECTED | INSUFFICIENT,
  reason, authorityRef, acceptedAt, evidenceDispositions[], auditReceiptRef
}
```

Scope is explicit I/O and references retain source scope. Institutional value
cannot expose tenant financial inputs unless grants allow those particular
fields/aggregates. SYSTEM may collect narrowly authorized observations at target
scope; it cannot own/accept benefit.

Forecast contains nullable amount/result, basis, confidence evidence, source time,
cost/effort assumptions and uncertainty. No precise number without measured or
explicitly sourced estimate basis. Baseline/window/unit/method are required for
claims where meaningful; qualitative claims need verifiable structured criteria.
Missing baseline is explicit limitation, not an invented zero.

## Lifecycle and authority

| Transition | Permitted actor / required condition |
| --- | --- |
| none -> FORECAST | Internal human benefit.create; owner/criteria/window/source explicit |
| FORECAST -> OBSERVED | Narrow observation collector/analyst submits measured evidence; source validated, baseline/limitations explicit; not human acceptance |
| FORECAST/OBSERVED -> UNPROVEN | Internal owner/reviewer or narrow validation monitor records insufficient/unknown evidence against criteria |
| UNPROVEN -> OBSERVED | New immutable observation satisfies evidentiary completeness; fresh scoped permission |
| OBSERVED -> REALIZED | Independent authorized internal human benefit.accept verifies criteria, attribution, evidence and recorded audit receipt |
| FORECAST/OBSERVED/UNPROVEN -> REJECTED | Authorized internal outcome reviewer records contrary evidence or forecast withdrawal with reason/disposition |
| REALIZED -> UNPROVEN/REJECTED | Authorized internal reassessment on new contradictory evidence, preserved prior acceptance and observation |

REALIZED is a purpose/window-specific authorized acceptance, not objective truth
for all future periods. Agent or external specialist may calculate/recommend/
submit narrow observations, never declare realization or accept its own effect.
Owner who produced the material claim/implementation requires independent
authorized internal acceptor. Outcome owner replacement is audited assignment;
historical acceptance identity/mandate remains frozen.

Rejected record cannot be reopened silently: new hypothesis is a new benefit/
revision linked to prior rejection with explicit internal authorization.
Reassessment of realized record preserves original REALIZED receipt/date and
explains current uncertainty/rejection; historical value never disappears.

## Attribution, double counting and disposition

Tie observation to exact Mission/Change/decision and measurement window; a
successful deployment only proves execution. Capture confounding incidents,
market/supplier changes, partial effects and alternative explanations. Realized
risk-reduction needs specific counterfactual/coverage criteria and evidence, not
merely no incident in a short period.

Shared benefits identify one benefit source and multiple beneficiary refs.
Portfolio aggregation deduplicates benefit ID + acceptance/window/unit and
attributes allocation via an approved method. Do not sum overlapping windows,
different units or unaccepted forecast values with realized figures.
Unknown/incomplete coverage means null/partial aggregation, not zero savings.
Amounts/currencies and costs are sourced; no financial transaction is created.

Evidence dispositions reuse existing evidence acceptance/retention: referenced,
verified, accepted, rejected, unknown/unavailable with purpose/reason/actor.
Integrity verification cannot alone realize a benefit. Internal acceptance
requires exact output/evidence revision and independent mandate. If required
source is unavailable or receipt pending, keep OBSERVED/UNPROVEN, not REALIZED.

Material forecast revision, observation, acceptance/rejection, owner amendment
and reassessment all use scoped CAS + before/after linked refs and durable audit
intent. Observations/acceptances are immutable. Default retention is RETAIN for
forecast versions, measurement inputs, acceptance/disposition and reassessment
proof; archives/caches cannot delete historical decisions or accepted evidence.

## Compatibility adapters

| Source vocabulary | Target meaning / non-mapping |
| --- | --- |
| Scoreback pending | Possible FORECAST reference only after explicit scoped linkage, not automatic benefit creation |
| Scoreback on-track/exceeded/missed | Progress assessment; may support OBSERVED with source evidence, never REALIZED automatically |
| Scoreback cancelled | Historical work disposition; not equivalent to evidence-based benefit REJECTED without review |
| CAPITAL live | Observed source freshness only; independent realization acceptance still required |
| CAPITAL manual / estimate | Declared/estimated basis retained; not promoted to measured benefit |
| CAPITAL unavailable | UNKNOWN/null source; no false zero benefit or healthy runway |
| Existing evidence disposition labels | Explicit source-preserving adapter to purpose acceptance status; unknown source value => UNKNOWN |

Compatibility table links source record/scope/revision and canonical Benefit ref
with governed mapping evidence. Legacy records not mapped remain LEGACY_UNRECONCILED.
Do not backfill historical acceptance identities or timestamps. NORTHSTAR, if
used as a heading, is a value/criteria projection; not a new investment authority.

## Failure and binary acceptance

| Test obligation | Required result |
| --- | --- |
| Run succeeded/scoreback exceeded but acceptance absent | FORECAST/OBSERVED/UNPROVEN, never REALIZED |
| Agent/specialist self-realizes or internal producer self-accepts | Denied; independent authorized internal human required |
| Baseline missing, units mixed, window overlaps | Explicit limitations/no invalid aggregate; no fabricated values |
| Audit delivery fails at acceptance | Pending acceptance not final; preserve observation, gate realization |
| Incident later contradicts realized service benefit | New reassessment/disposition, original acceptance still replayable |
| Unauthorized tenant financial evidence | No raw data/aggregate disclosure; scoped error/unknown coverage |
| Retention/cache expires | Historical acceptance/evidence preserved under governing policy |

All criteria score 3, `[Design]`. Future integration proof must include source
scorebacks, measurement/evidence, independent human acceptance and projection
failures; positive calculation tests alone do not prove realization authority.
