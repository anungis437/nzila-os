# Privacy Impact Assessment — Platform Cognition (Phase 1, Interpretable)

**Doc ID:** PIA-AI-PLATFORM-COGNITION-2026-001
**Status:** DRAFT (stub — full assessment TODO)
**Surface:** `packages/platform-cognition-core` (Memory · Trajectory · State · Consent engines)
**Phase:** 1 (interpretable algorithms — recency-weighted decay, calibrated logistic, Bayesian aggregation)
**Owner:** Platform Lead
**Privacy reviewer:** Privacy Lead / DPO
**Last update:** 2026-04-28

> **Stub notice.** This PIA exists to satisfy the inventory-integrity contract
> and to document the gap. The full PIA workshop is **TODO** — see
> [`governance/ai/maturity-assessment.md`](../../../ai/maturity-assessment.md) area #6.

## 1. Surface description

The platform cognition layer composes four engines:

- **Memory** — persistent, scoped, decaying user/org memory
- **Trajectory** — sequence-feature risk scoring over time
- **State** — explainable human-state inference
- **Consent** — consent-gate wrapping recall and inference output

Phase 1 is **interpretable** (no trained ML in the loop). Phase 2 will swap
in trained models from `@nzila/ml-core` once labeled data exists; that swap
is itself a re-classification trigger and requires AIGC approval before
deployment.

## 2. Risk classification

- **Tier:** 2 (Limited risk)
- **Rationale:** No automated decisions affecting persons; outputs are
  retrievals + interpretable scores consumed by other surfaces (e.g.,
  `packages/ue-cognition`) which apply their own gating.
- **Re-classification trigger:** swap to trained models → re-classify per
  [`governance/ai/risk-classification.md`](../../../ai/risk-classification.md) §4

## 3. Data scope

- **Subject:** tenant + org (and optionally user / domain entity)
- **Memory payloads:** application-supplied; consent gate applies at recall time
- **Highest tier expected:** Confidential (PII may appear in payloads)
- **Restricted-tier data:** payloads are minimized at write time; PHI MUST
  be redacted before write per the consent gate

## 4. Lawful basis

- Contract (operating Nzila services for the tenant)
- Legitimate interest (platform stability, governance signals)

## 5. Cross-border

None — Phase 1 is in-process / in-database; no external provider call.

## 6. Risks & mitigations (preliminary)

| Risk | Mitigation | Status |
|------|-----------|--------|
| Over-collection of PII in memory payloads | Caller-side minimization + consent gate at recall | Implemented |
| Stale memories about people who exercised deletion rights | DSAR runner clears memory rows by subject | TODO — verify |
| Inference output reveals attributes not consented for | Consent gate strips disallowed kinds | Implemented |
| Phase-2 trained models introduce opacity | Re-classification gate + new PIA before swap | Documented |

## 7. Open items (TODO before closing this stub)

- [ ] Confirm DSAR coverage of cognition memory tables
- [ ] Document retention defaults per `MemoryKind`
- [ ] Map upstream callers and their data tiers
- [ ] Document consent gate exceptions
- [ ] Sign-off by Privacy Lead

## 8. References

- Module docs: [`packages/platform-cognition-core/src/types.ts`](../../../../packages/platform-cognition-core/src/types.ts)
- Inventory entry: [`governance/ai/inventory.json`](../../../ai/inventory.json) `surfaces[platform-cognition-phase1]`
