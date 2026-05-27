# ADR — Engine/Product Separation for the NzilaOS Hierarchy

> **ADR ID:** PE-002
> **Status:** Accepted
> **Date:** 2026-05-08
> **Decision Makers:** NzilaOS Platform Engineering, Portfolio Governance
> **Domain:** Platform Architecture · Portfolio Topology
> **Supersedes:** N/A
> **Related:** [ADR-PE-001](./ADR-PE-001-dapl-platform-ledger.md), [PLATFORM_VS_APP_DECISION_RULE](../../governance/PLATFORM_VS_APP_DECISION_RULE.md), [PACKAGE_OWNERSHIP](../../governance/PACKAGE_OWNERSHIP.md), [PACKAGE_LIFECYCLE_POLICY](../../governance/PACKAGE_LIFECYCLE_POLICY.md)

---

## Context

NzilaOS has grown from a single Next.js app into a multi-product portfolio (UnionEyes, Veridian, Zonga, Trade, Mobility, CFO, Flow, …) backed by a sprawl of `packages/*-engine/` workspaces (`pricing-engine`, `consent-engine`, `deal-engine`, `mobility-case-engine`, `platform-decision-engine`, `platform-anomaly-engine`, `platform-policy-engine`, `platform-reasoning-engine`). Two structural failure modes have emerged repeatedly across the codebase and are now well documented in our governance corpus:

1. **App-shaped logic leaking into platform packages.** When a product team needs a capability quickly, they sometimes drop domain-specific behaviour into a `platform-*` package because "the engine already does almost that." This contaminates the engine's API surface with vertical concerns and forces every downstream product to absorb the brand vocabulary of whichever app shipped the leak first. `PLATFORM_VS_APP_DECISION_RULE.md` (anti-patterns section) flags this exact failure mode (`apps/flow/lib/anomaly-detector.ts → use platform-anomaly-engine`).
2. **Platform-shaped logic trapped inside an app.** The mirror failure: reusable workflow primitives (intake → routing → approvals → quoting → tasks → status → automations) get implemented directly inside `apps/flow/` and become inaccessible to other products that need the same primitives under different brands and UX. The Investor Readiness Audit Pack (IRAP) pre-launch review explicitly called out that Flow's workflow engine is currently fused to the Flow brand and therefore not reusable, contradicting the platform thesis.
3. **No formal distinction between an Engine and a Product.** The terms have been used interchangeably in plans, READMEs, and the governance manifest. There is no ADR defining what makes something an *engine* (headless, brand-neutral, SDK-only consumer surface) versus a *product* (branded, user-facing, opinionated UX with domain-specific workflows). Without that distinction, `pnpm exec tsx scripts/platform-vs-app-check.ts` cannot meaningfully enforce the rule it was built for.

The trigger for this ADR is the planned introduction of **Maestria** — a Tier-4 incubating product that packages workflow primitives into a French-first SMB-focused experience (Boutique / Comptoir / Atelier / Réseau verticals). Maestria forces us to extract the workflow capability out of `apps/flow/` into a reusable engine before a second product reimplements the same primitives. That extraction is the moment the engine/product distinction must become load-bearing rather than implicit.

### Constraints

1. **Invariant (a) — Engines have no end-user UI.** An engine ships TypeScript SDKs, schemas, and pure functions. It does not ship Next.js routes, React components, marketing copy, or brand assets. Any UI must live in a consuming product.
2. **Invariant (b) — Products consume engines via the SDK only.** A product MUST NOT import internal engine modules (`@nzila/<engine>/internal/*`, deep paths, or transitive engine internals). Only the public package entry (`@nzila/<engine>`) is permitted, mirroring the boundary already enforced by `flow-lockdown-check.ts` for Flow internals.
3. **Invariant (c) — Each capability lives in exactly one engine.** No two engines may own the same domain primitive. If two products need the same capability, the capability is hoisted into a single engine; it is never copy-pasted across engines or apps. This invariant is what makes `pnpm exec tsx scripts/platform-vs-app-check.ts` decidable.
4. **Tier model.** All products must declare a portfolio tier in `governance/portfolio/product-catalog.json` consistent with the existing TIER_LABELS (`1:'sell-now', 2:'strategic-growth', 3:'maintain', 4:'incubate', 5:'sunset'`). Engines do NOT carry a portfolio tier — they carry a lifecycle status (`incubating | stable | deprecated`) because they are not GTM units.
5. **CI enforcement.** Every invariant in this ADR must be enforceable by an automated check that runs in pre-commit (lefthook) and CI. A rule that cannot be enforced mechanically is a rule that will be violated within one quarter (consistent with our existing posture in `tooling/contract-tests/platform-api-surface.test.ts` and `pnpm exec tsx scripts/platform-vs-app-check.ts`).
6. **Brand isolation.** No engine package, schema, fixture, or test may reference a product brand by name (Maestria, UnionEyes, Veridian, Zonga, Trade, Mobility, Flow). Brand strings live exclusively in `apps/<product>/` and `governance/portfolio/product-catalog.json`. This makes engine reuse across the portfolio architecturally honest rather than aspirational.

---

## Decision

We formalise NzilaOS as a **two-layer hierarchy** of `Engines` and `Products`, codified in `governance/portfolio/product-catalog.json` (extending the schema with a top-level `engines[]` array), validated by `scripts/lib/portfolio-governance.ts` (new `validateEngines()` function), and enforced at the import-graph level by a new check `scripts/check-brand-leakage.ts` modelled on `apps/flow/scripts/flow-lockdown-check.ts`.

| Layer       | Type                                | Has UI? | Has brand? | Consumers                                  | Lifecycle dimension                    |
| ----------- | ----------------------------------- | ------- | ---------- | ------------------------------------------ | -------------------------------------- |
| **Engine**  | `packages/<name>-engine/`           | No      | No         | One or more products via published SDK     | `incubating \| stable \| deprecated`   |
| **Product** | `apps/<name>/`                      | Yes     | Yes        | End users (humans) and orchestrator agents | Portfolio tier 1–5 (TIER_LABELS)       |

Concretely, NzilaOS resolves to the following topology at the time of this ADR:

- **Engines:** `flow-engine` (NEW — extracted from `apps/flow/`), `cognition-engine` (existing reasoning/anomaly/decision/policy stack consolidated under one product-facing SDK over time), `ledger-engine` (DAPL — see ADR-PE-001), `identity-engine` (`@nzila/platform-auth` + organization resolution).
- **Products:** `Maestria` (Tier 4, incubating, FR-first SMB), `UnionEyes` (Tier 2), `Veridian` (Tier 2), `Zonga` (Tier 3), `Trade` (Tier 3), `Mobility` (Tier 3), `CFO` (Tier 3), `Flow` (continues to exist as a product but is no longer the home of workflow primitives — those move to `flow-engine`).

### Why a hybrid hierarchy (engines + products) instead of a flat package list

- Flat package lists make every package look equivalent to a reviewer, which is exactly how `apps/flow/lib/anomaly-detector.ts` came to exist. A two-layer model makes it structurally obvious where new capability belongs.
- The hybrid model maps cleanly onto our existing governance: portfolio-tiered units (Products) drive GTM, ARR, and proof-pack reporting; lifecycle-tracked units (Engines) drive platform investment and deprecation policy. We need both signals; they are not the same signal.
- A two-layer model is the minimum cardinality that lets `pnpm exec tsx scripts/platform-vs-app-check.ts` produce a deterministic verdict: "is this code reused across products?" If yes → engine; if no → product. Three or more layers (engine / kit / product / framework / …) reintroduces the ambiguity we are removing.

### Why exactly four engines at this ADR's freeze line

- **`flow-engine`** is the only engine being NEW-created in Phase 1. Its eight modules (`intake`, `routing`, `approvals`, `quoting`, `po-invoice`, `tasks`, `status`, `automations`) are the workflow primitives currently fused into `apps/flow/`. Maestria is the second consumer; UnionEyes case-flow and Veridian care-pathways are credible third and fourth consumers.
- **`cognition-engine`** is named here as a *target* — it will eventually consolidate `platform-reasoning-engine`, `platform-decision-engine`, `platform-anomaly-engine`, `platform-policy-engine` behind a single product-facing SDK. That consolidation is OUT OF SCOPE for this ADR; it will land in ADR-PE-003 with its own migration plan. Naming it now prevents future ADRs from re-litigating the topology.
- **`ledger-engine`** exists today as DAPL (per ADR-PE-001) and is already engine-shaped (no UI, append-only, SDK-consumed). This ADR formally classifies it as an engine to bring it under the same governance lifecycle as `flow-engine`.
- **`identity-engine`** wraps `@nzila/platform-auth` plus organization resolution (`getOrganizationIdForUser`). It is engine-shaped today but lives across multiple packages. Re-classification only — no code moves required for this ADR.

### Why Maestria is the forcing function (and why Tier 4 incubate)

- We could have extracted `flow-engine` opportunistically the next time UnionEyes or Veridian needed workflow primitives. We are choosing to extract it *now* because (i) Maestria's product brief explicitly requires the eight modules verbatim, (ii) extracting under the pressure of a real second consumer is the only way to ensure the engine's SDK is genuinely brand-neutral, and (iii) deferring extraction is how `apps/flow/lib/anomaly-detector.ts`-class anti-patterns are born.
- Maestria ships at Tier 4 (`incubate`) and `gtm_posture: internal-only`, `revenue_status: internal-cost-center` because the product's near-term value is *forcing the engine boundary to be honest*, not generating revenue. Promotion to Tier 3 or Tier 2 will be a separate decision once the Boutique vertical pack has externally validated traction.
- Maestria's tier-4 status means it deliberately passes `validateProducts()` without triggering `recommendationFor` upgrades. The `maturity_gaps` field will be explicit about what is intentionally absent (no commercial SLA, no marketing site, no public pricing).

### Why brand-leakage CI rather than convention

- Conventions documented in CONTRIBUTING.md are violated within one quarter under deadline pressure. Every governance posture we currently trust (DAPL invariants, Flow lockdown, platform API surface, secret scanning) is enforced by a green/red check, not by a doc.
- `scripts/check-brand-leakage.ts` will run four rule sets in pre-commit and CI: `ENGINE_BRAND_LEAKAGE` (no product brand strings in `packages/*-engine/`), `PRODUCT_INTERNAL_IMPORT` (no `@nzila/<engine>/internal/*` from `apps/`), `CROSS_PRODUCT_IMPORT` (no `apps/<a>/` importing from `apps/<b>/`), `ENGINE_APP_IMPORT` (no `packages/*-engine/` importing from `apps/`). Each rule has an `EXEMPT_PATHS` allowlist for legitimate edge cases (test fixtures, generated types).
- This mirrors the proven pattern in `apps/flow/scripts/flow-lockdown-check.ts` — a check that has caught real regressions in the last two months.

---

## Consequences

### Positive

- **Maestria can be built without copying Flow.** The eight workflow modules are imported once, branded twice, governed in one place.
- **`pnpm exec tsx scripts/platform-vs-app-check.ts` becomes decidable.** Reviewers get a deterministic verdict on every new module instead of a judgment call.
- **Future engines have a published template.** ADR-PE-003 (cognition consolidation), ADR-PE-004 (next engine extraction), etc. follow the structure established here without re-deriving the rationale.
- **Portfolio governance gets a missing dimension.** The truth manifest now distinguishes platform investment (engines) from GTM units (products), which the CFO reporting layer needs to allocate platform OpEx correctly.
- **Brand leakage becomes a build error, not a code review smell.** The check fails closed.

### Negative

- **One-time extraction cost for `flow-engine`.** Eight modules of working code in `apps/flow/` must be moved, re-tested, and re-imported. Estimated cost is real but bounded by the existing test suite.
- **Two products to maintain (`Flow` + `Maestria`) for at least one quarter.** Until `Flow` is fully refactored to consume `flow-engine` via SDK, both apps will exist with overlapping surface area. This is acceptable because `Flow` is Tier 3 (`maintain`) and the duplication window is explicit.
- **A new CI check adds ~1–3s to every pre-commit and PR build.** Acceptable given the failure modes it prevents.
- **Engine SDK design is now load-bearing.** A bad SDK boundary in `flow-engine` will hurt every consumer. We mitigate by treating Maestria as the first real customer and refusing to ship the engine until Maestria can drive every primitive through the public surface.

### Risks

- **Risk: cognition-engine consolidation slips.** Naming it in this ADR creates an expectation. Mitigation: ADR-PE-003 will own the consolidation and may legitimately delay it; this ADR does not block on it.
- **Risk: brand-leakage check produces false positives in marketing/i18n strings.** Mitigation: `EXEMPT_PATHS` allowlist + the rule scans only `packages/*-engine/src/**` (not `apps/`, not `governance/`).
- **Risk: teams route around the rule by importing engine internals through a re-export shim in their own app.** Mitigation: `PRODUCT_INTERNAL_IMPORT` rule scans transitive re-exports, and the contract test `tooling/contract-tests/platform-api-surface.test.ts` already covers this attack surface for platform packages.
- **Risk: Maestria becomes a permanent Tier 4 zombie.** Mitigation: Tier 4 entries in the truth manifest now require an explicit `maturity_gaps.exit_criteria` field (validated by `validateProducts()`) defining what promotes the product to Tier 3 or sunsets it.

---

## Alternatives Considered

1. **Pure-app monolith ("just keep building inside `apps/flow/`").** Rejected: this is the status quo that produced the current platform/app confusion. Adding Maestria to the same pattern guarantees a third reimplementation of workflow primitives within the next two products.
2. **Pure-platform stack ("extract every primitive into a `packages/*` regardless of reuse").** Rejected: this is the failure mode that produced over-fragmented `platform-*` packages with overlapping responsibilities. Without the explicit *product* layer, engines accrete UI concerns again under the next deadline. The hybrid model preserves the discipline of the platform thesis while keeping product velocity.
3. **Micro-services / per-product runtime isolation ("split each product into its own deployable").** Rejected: deployment topology is orthogonal to the engine/product distinction. We may eventually split runtimes for capacity reasons, but doing so now would conflate two unrelated decisions and is not required for the architectural cleanup this ADR is performing. The current Azure Container Apps topology (one app per product, shared engines as workspace packages) is preserved unchanged.
4. **Adopt an existing taxonomy (e.g. Backstage "Component / System / Domain").** Rejected — *partially*: we already use Backstage `catalog-info.yaml` per app and will continue to. Backstage's three-level model is a discoverability taxonomy, not an architectural-boundary taxonomy. We adopt the Backstage labels in catalog metadata but use this ADR's two-layer model for the actual import-graph rule.

---

## References

- [docs/governance/PLATFORM_VS_APP_DECISION_RULE.md](../../governance/PLATFORM_VS_APP_DECISION_RULE.md) — the underlying decision framework this ADR operationalises.
- [docs/governance/PACKAGE_OWNERSHIP.md](../../governance/PACKAGE_OWNERSHIP.md) — owner-of-record for each engine.
- [docs/governance/PACKAGE_LIFECYCLE_POLICY.md](../../governance/PACKAGE_LIFECYCLE_POLICY.md) — the `incubating | stable | deprecated` lifecycle engines follow.
- [docs/commerce/ADR/ADR-PE-001-dapl-platform-ledger.md](./ADR-PE-001-dapl-platform-ledger.md) — `ledger-engine` (DAPL) is reclassified by this ADR.
- [tooling/contract-tests/platform-api-surface.test.ts](../../../tooling/contract-tests/platform-api-surface.test.ts) — existing surface-area enforcement that the new brand-leakage check complements.
- [apps/flow/scripts/flow-lockdown-check.ts](../../../apps/flow/scripts/flow-lockdown-check.ts) — pattern source for `scripts/check-brand-leakage.ts`.
- [governance/portfolio/product-catalog.json](../../../governance/portfolio/product-catalog.json) — receives the new top-level `engines[]` array and the Maestria entry.
