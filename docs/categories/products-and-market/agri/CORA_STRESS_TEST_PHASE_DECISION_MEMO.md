# Cora Stress-Test Phase Decision Memo Contract

**Version:** `cora-stress-test-memo-1.0`
**Scope:** one page per route/phase/locked test version, not a filled result.

Use with the [framework](CORA_STRESS_TEST_FRAMEWORK.md) and
[registry](CORA_STRESS_TEST_REGISTRY.json). No observations are supplied here.

## Required header

Memo ID/version/date; ROUTE_A or ROUTE_B; handoff evidence reference;
phase 0-5; test ID/version/locked hash; responsible owner; participant class;
authority/privacy/source-rights authorization references; observation window;
baseline version; evidence locations/digests and access restrictions.
Missing values remain explicit and disposition BLOCKED_EVIDENCE.

## Eight required answers

1. **What did we test?** Exact pre-registered hypothesis, metrics/units,
   pass/redirect/kill criteria and legitimate comparison workflow.
2. **What actually happened?** Observed actor behaviour/results, sample and
   timeframe, missing/censored values. Label synthetic controls separately;
   no interview findings invented or intention reported as behaviour.
3. **What evidence supports it?** Evidence IDs/digests, origin, scope,
   collection authority and limitations; quote only where permitted.
4. **Did the threshold pass?** Locked-version comparison, kill-first result,
   evaluator output and qualitative/rights constraints. Record approved
   prospective amendments and deviations without overwriting prior results.
5. **What did we learn?** Bounded interpretation, not source truth or marketing.
6. **What remains uncertain?** Rights, legal duties, currentness, sample,
   liability, missing indicators or conflicting evidence.
7. **Continue / redesign / policy redirect / stop?** One route/phase state:
   PASS, PASS_WITH_CONDITIONS, REDIRECT_POLICY, REDESIGN, BLOCKED_EVIDENCE,
   FAIL or NOT_STARTED. Conditions have owners, evidence and closure states;
   mandatory/recipient authority is never waived by an arithmetic pass.
8. **What is the next authorized action?** Exact human decision reference,
   stage/scope/owner/expiry and outstanding gates, or NONE_AUTHORIZED.
   A memo is not itself a production/source permission.

## Signoff and preservation

Record decision owner/reviewer, actual decision date, rationale and evidence.
Bind the registry decision to this memo ID, locked test hash and separate
numeric threshold result. Persist original versions, deviations and
retests in the approved governance record; do not blind-pool changed
baselines/cohorts. No real participant evidence belongs in the repository.
Route A's memo never fills route B's missing result.
