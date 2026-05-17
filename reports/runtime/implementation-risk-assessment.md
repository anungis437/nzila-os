# Union Eyes — Implementation Risk Assessment

**Audit date:** 2026-05-15
**Posture:** validation-only · risk assessment for the recommended remediation waves

Each remediation wave from `prioritized-remediation-sequencing.md` is assessed on three dimensions: substrate risk, narrative risk, and procurement-link risk. A wave is approved for execution only when all three are tractable.

---

## Risk dimensions

| Dimension | Definition |
| --- | --- |
| Substrate risk | Probability that the change perturbs the IGG / continuity / chronology / topology projection or its tests. |
| Narrative risk | Probability that the change introduces drift (hard-fail vocabulary, surveillance framing, scoring semantics). |
| Procurement-link risk | Probability that an external link / deep-link from marketing collateral or a procurement reviewer's saved URL breaks. |

Each is graded `low` / `medium` / `high`.

---

## Wave-by-wave assessment

### Wave 1 — Vocabulary hard-fail removal

| Dimension | Grade | Reasoning |
| --- | --- | --- |
| Substrate risk | low | All changes are string / comment / redirect; no substrate touched. |
| Narrative risk | low | Strictly removes forbidden tokens; cannot regress narrative. |
| Procurement-link risk | low (medium for `/leaderboard`) | The leaderboard route is unlikely to be deep-linked; redirect preserves access. |

**Mitigation:** preserve the `/leaderboard` redirect for at least one release.

---

### Wave 2 — Substrate adoption on depth-2 cockpits

| Dimension | Grade | Reasoning |
| --- | --- | --- |
| Substrate risk | medium | Touches projection wiring on four cockpits. |
| Narrative risk | low | Adds provenance + explainability disclosure; cannot regress narrative. |
| Procurement-link risk | low | URLs unchanged; only render output enriched. |

**Mitigation:** land one cockpit per PR; verify IGG test count remains ≥ 162 after each PR.

---

### Wave 3 — Cognition convergence

| Dimension | Grade | Reasoning |
| --- | --- | --- |
| Substrate risk | medium-high | Routes the cognition page through the orchestration pipeline that until now has only served two consumers; pipeline must accept a new caller without performance regression. |
| Narrative risk | medium | Output transitions from raw KPI snapshots to storied envelopes — copy review required to ensure assistive disclosure remains visible. |
| Procurement-link risk | low | URL unchanged. |

**Mitigation:** behind a feature flag for one release; benchmark `runFullInstitutionalCognition` latency before flipping the flag.

---

### Wave 4 — Drift label reframing

| Dimension | Grade | Reasoning |
| --- | --- | --- |
| Substrate risk | low | Strings only. |
| Narrative risk | low | Removes drift; gates re-run will confirm. |
| Procurement-link risk | low | URLs unchanged. |

**Mitigation:** none required.

---

### Wave 5 — Locale parity

| Dimension | Grade | Reasoning |
| --- | --- | --- |
| Substrate risk | low | Translation bundle additions only. |
| Narrative risk | low-medium | New French institutional vocabulary must be translation-reviewed by a Quebec-fluent reviewer; an unreviewed translation could itself drift. |
| Procurement-link risk | low | No URL change. |

**Mitigation:** require one Quebec-fluent reviewer signoff on the fr-CA additions before merge.

---

### Wave 6 — Hygiene + gate hardening

| Dimension | Grade | Reasoning |
| --- | --- | --- |
| Substrate risk | low | Routing changes only on excluded scaffolds. |
| Narrative risk | low | Gate hardening — improves drift detection. |
| Procurement-link risk | medium | Auth duplicate consolidation could break a procurement reviewer's bookmark; analytics dedup could break an internal bookmark. |

**Mitigation:** preserve permanent redirects on every removed root-level auth path; preserve a redirect on `/dashboard/analytics` if the canonical surface is moved.

---

## Cross-wave risks

| Risk | Mitigation |
| --- | --- |
| Two of the four state-9 governance-sensitive surfaces (`/dashboard/cognition`, `/dashboard/longitudinal-cognition`) are touched in Waves 3-4. | Run protected-token sweep after Wave 3 to confirm no leakage into the now-storied output. |
| Localization rollout (Wave 5) must not contradict re-label work in Wave 4. | Land Wave 4 first; have Wave 5 reference the new English labels. |
| Gate hardening (Wave 6) could fail in-flight changes if not last. | Keep Wave 6 at the end of the sequence. |
| WS H adapter is new (commit `727c2395c`). Adoption pressure across four cockpits in Wave 2 stresses it. | Keep IGG test suite green after every cockpit; add a snapshot test per cockpit. |
| The 162-test IGG suite is the only substrate gate. | Add coverage to the snapshot tests as cockpits adopt the adapter. |

---

## Aggregate risk verdict

The remediation plan as sequenced is **low-to-medium risk** overall:

- Three waves (1, 4, 5) are essentially zero-risk additive changes.
- Two waves (2, 3) carry medium substrate risk that is fully mitigated by the existing IGG test suite + per-PR scope.
- One wave (6) carries medium procurement-link risk that is fully mitigated by permanent redirects.

No wave introduces irreversible architectural change, schema mutation, or governance posture shift. Every wave is reversible by reverting the merge commit.

**Approval threshold:** maintainer signoff per wave. No multi-wave batches.
