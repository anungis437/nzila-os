# Gate Taxonomy & CI Authority

> **Status:** Doctrine (Phase 5 of the UE Hardening & Gate Convergence Wave)
> **As of:** 2026-06-28
> **Authority source:** [`governance/gates/gate-authority-registry.json`](../../../governance/gates/gate-authority-registry.json) (`$schema: gate-authority-registry/v2`)
> **Runner:** [`tooling/governance/gate-authority.ts`](../../../tooling/governance/gate-authority.ts)
> **Contract test:** [`tooling/contract-tests/gate-authority.test.ts`](../../../tooling/contract-tests/gate-authority.test.ts) (`INV-GATE-AUTHORITY`)

## Why this exists

The repository runs ~36 governance validators. Before Phase 5, "the gates are
green" did **not** reliably mean "the right things passed at the right stage" —
some validators were advisory diagnostics, some were superseded/deprecated, and
some were aspirational production-certification checks that have **never** been
achieved. A green dashboard hid those distinctions.

Phase 5 makes gate authority **explicit and honest**. It does **not** promote any
validator. The goal is *not* "everything is green." The goal is:

> The repo now knows **which green matters**, **which red is advisory**, and
> **which red blocks production certification later**.

## The single source of truth

Every governance validator has exactly one entry in the registry with an explicit
`classification`. **`classification` is the enforced authority.** A separate
`targetClassification` field records aspiration only and **never** changes CI
behavior. Promotion from advisory to blocking happens **only** through a PR that
records stability evidence — *running green is necessary but not sufficient.*

## Taxonomy — the seven categories

| Category | Enforcement | Stage | Meaning |
| --- | --- | --- | --- |
| `pr-blocking` | **blocking** | pull-request | Must pass on every PR / push to main. Failure fails CI immediately. |
| `release-blocking` | **blocking** | release | Must pass before a release/deploy is cut. Failure blocks the release pipeline. |
| `pilot-blocking` | **blocking** | controlled-pilot | Must pass for a controlled-pilot deployment to remain safe. *(No registry gates yet — UE pilot-safety invariants currently live as contract tests.)* |
| `production-blocking` | **blocking** | production-certification | Must pass for FULL production certification. **No gate has achieved this yet** — aspirational only, tracked via `targetClassification` + `promotionCondition`. |
| `advisory` | report-only | any | Runs and is reported (annotated as a warning) but **never** fails CI. Signal-only / diagnostic / not-yet-promoted. |
| `experimental` | report-only | any | Doctrine / evidence model not yet sealed. Runs only in non-blocking mode. (Was `future_doctrine` in v1.) |
| `deprecated` | excluded | none | Superseded by a newer gate. Excluded from canonical CI execution; retained for audit replay only. Output is **not** authoritative. |

### Enforcement semantics

- **blocking** — Failure fails the workflow at the gate's stage.
- **report-only** — Runs and annotates (`::warning::`) but never fails the workflow.
- **excluded** — Not executed in canonical CI; retained for audit replay only.

## Authority rules (non-negotiable)

1. `classification` is the **enforced** authority. `targetClassification` is aspirational **only** and never changes CI behavior.
2. A gate may be promoted to a `*-blocking` classification **only** via a PR that records stability evidence. Running green is **necessary but not sufficient**.
3. A gate whose target is `production-blocking` but which has **not** met its `promotionCondition` **must** remain `classification: advisory`.
4. `final:go` remains advisory until: **zero missing certification artifacts AND a full-chain rehearsal pass**.
5. Promoting `experimental → blocking` requires: (1) evidence model documented, (2) green run on main for ≥ 7 days, (3) a PR updating the registry.

## Per-gate metadata schema

Each gate entry carries:

| Field | Purpose |
| --- | --- |
| `id`, `name` | Stable identifier + human label. |
| `command` / `script` / `path` | How the gate is invoked / where it lives. |
| `purpose`, `rationale` | What it checks and why it matters. |
| `classification` | **Enforced** authority (one of the seven categories). |
| `scope`, `owner` | Blast radius and accountable owner. |
| `promotionCriteria[]` | What must be true to raise authority. |
| `demotionCriteria[]` | What would justify lowering authority. |
| `knownLimitations[]` | Honest caveats / known false-or-missing signals. |
| `lastVerified` | When the classification was last reconciled. |
| `targetClassification`, `promotionCondition` | *(optional)* Aspiration only — no CI effect. |
| `repairRequired` | *(optional)* Gate has a **real** failing signal that is deferred, not path drift. |
| `supersededBy` | *(optional)* For deprecated gates: the replacement(s). |

## Current state — honest snapshot (2026-06-28)

| | Count |
| --- | --- |
| Total gates | **36** |
| Enforced blocking (`pr-blocking` + `release-blocking`) | **19** |
| Report-only (`advisory` + `experimental`) | **15** |
| Excluded (`deprecated`) | **2** |
| **Production-blocking achieved** | **0** |
| Production-blocking **targets** | `validate-live-readiness`, `validate-infra-convergence`, `validate-final-go` |

### Blocking — `pr-blocking` (15)

These fail CI on every PR: `validate-canonical-truth`, `validate-truth-authority`,
`validate-product-catalog`, `validate-portfolio`, `inventory-check`,
`validate-auth-authority`, `validate-evidence-lifecycle`,
`validate-governance-gate`, `validate-control-manifests`, `contract-tests`,
`validate-runtime-truth`, `validate-maturity`, `validate-org-resolver-guardrail`,
`validate-portfolio-governance`, `financial-service-health`.

### Blocking — `release-blocking` (4)

These block a release/deploy: `validate-ga-state`, `release-migration-safety`,
`db-drift-check`, `ga-check`.

### Advisory — report-only (10)

Runs and is **visible**, but does **not** fail CI:

| Gate | Note |
| --- | --- |
| `validate-governance-runtime-budget` | Diagnostic. |
| `validate-runtime-integrity` | Target `release-blocking` (not yet promoted). |
| `validate-runtime-authority` | Target `release-blocking`. **Green after Phase 4**, but green ≠ promotion — left advisory deliberately. |
| `validate-runtime-convergence` | Reclassified `deprecated → advisory` after Phase 4 path repair; now green **via legacy doc fallback**. Flagged for re-deprecation once `validate-runtime-integrity` subsumes it. **Not promoted.** |
| `validate-operational-honesty-guardrail` | Target `pr-blocking`. |
| `validate-live-readiness` | Target **`production-blocking`** — evidence **absent**; do not fabricate. |
| `validate-infra-convergence` | Target **`production-blocking`** — evidence absent. |
| `validate-ue-infrastructure` | **`repairRequired`** — real failing signal: required upstream doctrine anchors were **archived** to `docs/categories/historical-archive/archive/iterations/nzila-*`; final UE review doc is missing required validator references (see Phase 4 report). Not repointed at archived snapshots. |
| `validate-navigation-monetization` | **`repairRequired`** — final navigation/monetization review doc is missing required validator references. |
| `validate-final-go` | `pnpm final:go`. Target **`production-blocking`**. **Visible but advisory** until zero missing certification artifacts AND a full-chain rehearsal pass. **Never made blocking by Phase 5.** |

### Experimental — report-only (5)

Doctrine not yet sealed: `validate-cognition`, `validate-labor-continuity`,
`validate-tier2-hardening`, `validate-sovereignty-proving`,
`validate-residual-closure`.

### Deprecated — excluded (2)

Retained for audit replay only, **not** executed in canonical CI:

- `validate-final-convergence` — superseded by `validate-canonical-truth` + `validate-truth-authority` + `validate-maturity`.
- `validate-maturity-elevation` — superseded by `validate-maturity`.

## How authority is enforced in CI

The `gate-authority` job in
[`.github/workflows/nzila-governance.yml`](../../../.github/workflows/nzila-governance.yml)
does **not** re-execute the heavy validators (that would risk hard-failing on
*known* advisory failures). Instead it:

1. **`pnpm gate-authority:validate`** *(blocking)* — fails CI if any gate is
   missing or has an invalid classification, or if a `production-blocking` target
   is dishonestly marked already-blocking.
2. **`pnpm gate-authority:selftest`** *(blocking)* — a synthetic proof that an
   advisory failure does **not** fail CI while a blocking failure **does**, and
   deprecated gates are excluded.
3. **`pnpm gate-authority:report`** *(non-failing)* — renders the classification
   map, emits `::warning::` annotations for advisory / repair-required /
   production-target gates, and uploads `reports/governance/gate-authority-map.json`.

The same semantics are locked by the `INV-GATE-AUTHORITY` contract test.

## What Phase 5 explicitly did NOT do

- It did **not** promote any advisory validator to blocking (running green ≠ promotion).
- It did **not** make `final:go` blocking.
- It did **not** fabricate missing evidence or repoint `validate-ue-infrastructure` at archived doctrine snapshots.
- It did **not** claim production readiness — **0** gates have achieved `production-blocking`.
