# Human Continuity Theory™ Alignment Audit

ARTIFACT_TYPE: Question Architecture Audit™ — Part 11
DOCTRINE_VERSION: 1.1.0
AUDIT_VERSION: 1.0.0
GROUND_TRUTH: [QUESTION_ARCHITECTURE_INVENTORY.md](./QUESTION_ARCHITECTURE_INVENTORY.md)

> **Audit question.** Does the question architecture **operationalize** the eight Human Continuity Theory™ constructs, or does it merely use the vocabulary while measuring something else?

---

## 1. The eight HCT constructs

| Construct | Definition |
|---|---|
| **HCT-1** Stewardship continuity | The ability of an institution to identify, recognize, and equitably distribute stewardship responsibility. |
| **HCT-2** Governance continuity | The ability of governance reasoning to survive leadership transitions and be reconstructed without recourse to long-tenured individuals. |
| **HCT-3** Onboarding survivability | The ability of a newly arrived person to act on real institutional context within a bounded time horizon. |
| **HCT-4** Reconstruction burden | The institutional work required to recover knowledge, process, or governance reasoning after a continuity break. |
| **HCT-5** Institutional memory continuity | The institution's capacity to preserve the *why* of past decisions, not only the *what*. |
| **HCT-6** Continuity debt | Accumulated unaddressed continuity fragility — comparable in posture to technical debt. |
| **HCT-7** Continuity transfer | The mechanisms by which continuity passes from one person, generation, or system to the next. |
| **HCT-8** Modernization fragility | The continuity loss pathway specific to technology / system / process modernization. |

---

## 2. Operationalization map

| Construct | Operationalizing questions | Operationalizing framework | Operationalizing facilitation surface | Status |
|---|---|---|---|:--:|
| **HCT-1 Stewardship continuity** | od_01, od_04, icb_01, icb_02, cf_01, scs_01, scs_03 | SDI · CBM | Stewardship Density Review session; `stewardship-hotspots` discovery; `stewardship-burden` conversation category | ✅ **Operationalized** |
| **HCT-2 Governance continuity** | gv_01..gv_04, gis_01, ccs_02, scs_02 | GES | Governance Continuity Plan Ratification session; `governance-landscape` discovery; `governance-survivability` + `governance-interpretation-drift` conversation categories | ✅ **Operationalized** |
| **HCT-3 Onboarding survivability** | od_05, onb_01, ccs_04, scs_05 | CSM | `onboarding-fragility` conversation category | ✅ **Operationalized** |
| **HCT-4 Reconstruction burden** | im_01..im_04, orl_01, orl_02, if_01, ccs_03 | RBI | `operational-reconstruction` conversation category | ✅ **Operationalized** |
| **HCT-5 Institutional memory continuity** | im_01..im_04, orl_02, if_01, et_05 | RBI | `institutional-memory` conversation category | ✅ **Operationalized** |
| **HCT-6 Continuity debt** | et_02 (trust debt), risk-inverted: gv_03, orl_01, sg_03 | CBM (debt accumulation) | `continuity-fragility` discovery | ⚠️ **Partially operationalized** — single dedicated probe (`et_02`); no composite debt index yet |
| **HCT-7 Continuity transfer** | tr_03, scs_01, scs_03, scs_05 | CSM (transfer topology) | `governance-survivability` (transfer of governance) | ✅ **Operationalized** |
| **HCT-8 Modernization fragility** | mt_01, mt_02, ccs_05 | (no dedicated framework) | `modernization-pressure` discovery; `modernization-risk` conversation category | ⚠️ **Partially operationalized** — only 3 prompts; no dedicated framework index |

---

## 3. Findings

**Finding HCT-A (Pass).** Six of eight constructs are operationalized end-to-end (questions → framework → facilitation).

**Finding HCT-B (Medium).** **HCT-6 Continuity debt** lacks a dedicated *index*. The construct is theoretically central (the doctrine treats continuity debt as a first-class concept) but no `ContinuityDebtIndex` exists. Disposition: introduce `continuity-debt-index.ts` framework in v1.2.0; aggregates trust_debt, risk-inverted maturity, governance entropy, and reconstruction burden into a single debt posture.

**Finding HCT-C (Medium).** **HCT-8 Modernization fragility** lacks a dedicated framework. Modernization signals are scattered across `sovereignty_governance` section. Disposition: introduce `modernization-fragility-index.ts` framework in v1.2.0; consumes mt_01, mt_02, ccs_05 plus a new `multiple_choice` modernization topology probe.

**Finding HCT-D (Pass).** The architecture *operationalizes* HCT — it does not merely import the vocabulary. Every construct has named question inputs, named framework consumers (where present), and named facilitation surfaces.

---

## 4. Anti-claim alignment

| Anti-claim | Honored by HCT operationalization? |
|---|:--:|
| No equivalence with ISO standards | ✅ HCT is a distinct theoretical construct |
| No institutional ranking | ✅ HCT outputs are intra-institutional, not comparative |
| No AI behavioural inference | ✅ HCT measures institutional properties, not behaviours |
| No individual attribution | ✅ HCT constructs are role-class / structural, never person-class |
| No surveillance | ✅ Operationalization rests on structural observation, not personal observation |
| No psychometric profiling | ✅ HCT is institutional theory, not psychological theory |

---

## 5. Enforcement

Cross-references in [`entropyCoverage.test.ts`](../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/entropyCoverage.test.ts) and [`questionSignalIntegrity.test.ts`](../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/questionSignalIntegrity.test.ts) assert:

- Every HCT construct has ≥ 3 operationalizing questions.
- Every HCT construct that has a dedicated framework (HCT-1, 2, 3, 4, 5, 7) is consumed by the corresponding framework's input set.
- HCT-6 and HCT-8 are flagged as `MUST_EVENTUALLY_HAVE_DEDICATED_INDEX` (currently failing; tracked).
