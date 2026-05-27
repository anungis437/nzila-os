# Wave 10 — Platform Ontology Stabilization Review

Date: 2026-05-25
Scope: Union Eyes continuity architecture convergence across routes, modules, gates, onboarding, pricing, GTM, and platform identity.

## 1. Executive Verdict

Union Eyes is converging on the right institutional model, but naming and route ontology are not fully stabilized.

- Converged in doctrine and GTM posture: yes.
- Converged in operational substrate and governance runtime: yes.
- Converged in canonical route and API namespaces (`/app/oci`, `/app/ocra`, `/api/oci/*`): not yet.

Current state is best classified as: **architecturally convergent, namespace-divergent**.

## 2. Canonical Model Under Review

Reviewed against this continuity architecture:

1. OCI Foundations
2. OCRA Intelligence
3. Operations Core
4. Governance Continuity
5. Institutional Intelligence

And the dual-entry motion:

- OCRA-first (executive / modernization)
- Operations-first (operations / unions)

## 3. Evidence Base (Repo-Observed)

### 3.1 Identity, category, and procurement posture

- Institutional operating infrastructure category is already explicit in [final-ue-operating-infrastructure-review.md](../institutional-operating-infrastructure/final-ue-operating-infrastructure-review.md#L1).
- Navigation and IA are already framed around institutional flows in [full-navigation-ia-rearchitecture.md](../institutional-operating-infrastructure/full-navigation-ia-rearchitecture.md#L1).
- Procurement and sales motion are already continuity-governance-first in [full-procurement-sales-motion-refactor.md](../institutional-operating-infrastructure/full-procurement-sales-motion-refactor.md#L1).
- Monetization is maturity-tiered (not AI utility) in [full-monetization-rearchitecture.md](../institutional-operating-infrastructure/full-monetization-rearchitecture.md#L1).

### 3.2 Route and module runtime baseline

- Canonical dashboard modules and retire/merge posture already documented in [full-canonical-module-inventory.md](full-canonical-module-inventory.md#L1).
- Root entry redirects to locale root (marketing + authenticated portal split) in [app/page.tsx](../../../../../apps/union-eyes/app/page.tsx#L1).
- Locale root already supports continuity-first and authenticated operations entry in [app/[locale]/page.tsx](../../../../../apps/union-eyes/app/[locale]/page.tsx#L1).

### 3.3 Concrete route/API signals relevant to ontology

- OCI category entry exists at [app/[locale]/organizational-continuity-risk/page.tsx](../../../../../apps/union-eyes/app/[locale]/organizational-continuity-risk/page.tsx#L1).
- OCRA API domain exists under [app/api/ocra/start/route.ts](../../../../../apps/union-eyes/app/api/ocra/start/route.ts#L1) and sibling OCRA routes.
- Operations workbench exists at [app/[locale]/dashboard/work/page.tsx](../../../../../apps/union-eyes/app/[locale]/dashboard/work/page.tsx#L1).
- Governance runtime exists at [app/[locale]/dashboard/governance/page.tsx](../../../../../apps/union-eyes/app/[locale]/dashboard/governance/page.tsx#L1) and [app/api/governance/dashboard/route.ts](../../../../../apps/union-eyes/app/api/governance/dashboard/route.ts#L1).
- Communications continuity primitives exist under [app/[locale]/dashboard/communications/page.tsx](../../../../../apps/union-eyes/app/[locale]/dashboard/communications/page.tsx#L1) and [app/api/communications/campaigns/route.ts](../../../../../apps/union-eyes/app/api/communications/campaigns/route.ts#L1).
- Search/retrieval primitives exist under [app/api/search/universal/route.ts](../../../../../apps/union-eyes/app/api/search/universal/route.ts#L1).

## 4. Canonical Layer Alignment Matrix

Status legend:

- Aligned: runtime implementation matches canonical intent.
- Partial: intent exists but naming/topology diverges.
- Gap: no canonical implementation found.

### 4.1 OCI Foundations

- Intent: institutional continuity discovery.
- Runtime status: Partial.

What is aligned:

- OCI-style entry funnel and assessment flow are implemented via organizational continuity risk and continuity assessment routes.
- Entry-tier pricing ladder is explicitly OCI-first in [app/[locale]/(marketing)/pricing/page.tsx](../../../../../apps/union-eyes/app/[locale]/(marketing)/pricing/page.tsx#L1).

What diverges from canonical namespace:

- No UI route namespace using `/app/oci/*`.
- No API namespace using `/api/oci/*`.

### 4.2 OCRA Intelligence

- Intent: adaptive continuity intelligence.
- Runtime status: Partial to strong.

What is aligned:

- OCRA APIs exist and appear active (`start`, `submit`, `results`, `report`, telemetry).
- Continuity intelligence surfaces exist in dashboard naming (`intelligence`, `continuity-intelligence`).

What diverges:

- No canonical UI namespace `/app/ocra/*`.
- API contract naming differs from proposed canonical (`/api/ocra/routing`, `/confidence`, `/contradictions`, etc. are not the current route names).

### 4.3 Operations Core

- Intent: continuity-aware operational execution.
- Runtime status: Strong (with namespace divergence).

What is aligned:

- Core operations surfaces are implemented: work, grievances/cases, governance, committees, communications, onboarding, outcomes.
- Operations-first practical workflow is explicit in route structure and user journey validation in [USER_JOURNEY_VALIDATION.md](../../../../../apps/union-eyes/docs/operations/USER_JOURNEY_VALIDATION.md#L1).

What diverges:

- Canonical path families (`/app/work/*`, `/app/investigations/*`, `/app/continuity/docs/*`) are mostly represented under `/[locale]/dashboard/*` and domain-specific names.
- Investigations are represented through case/evidence/timeline routes rather than a dedicated `/investigations` namespace.

### 4.4 Governance Continuity

- Intent: executive continuity governance.
- Runtime status: Strong.

What is aligned:

- Governance UI and API surfaces are extensive, including lifecycle, policy events, snapshots, conflicts, board packets, and elections.
- Gating and sovereignty posture has prior wave evidence in [wave5-institutional-refinement-review.md](wave5-institutional-refinement-review.md#L1).

What diverges:

- No canonical `/app/governance-continuity/*` namespace; governance is currently consolidated under `/dashboard/governance` and `/api/governance/*`.

### 4.5 Institutional Intelligence

- Intent: longitudinal continuity observatory.
- Runtime status: Partial to strong.

What is aligned:

- Intelligence surfaces exist (`intelligence`, `executive-operating-intelligence`, continuity intelligence, cross-union analytics).
- Tier and gate logic already documented in runtime authority waves.

What diverges:

- No explicit `/app/intelligence/observatory` style namespace.
- Longitudinal observatory language is present doctrinally, but runtime route taxonomy is still mixed.

## 5. Dual-Path Continuity Convergence Check

### 5.1 OCRA-first path

Status: Present.

- OCI/OCRA discovery and assessment-to-brief flow is explicit in marketing and pricing journey.
- OCRA APIs are real, and organizational continuity assessment is first-class.

### 5.2 Operations-first path

Status: Present.

- Work, grievances/cases, governance operations, communications, and onboarding routes are operationally rich.

### 5.3 Convergence rule

Status: Mostly satisfied.

- OCI/OCRA messaging references operational continuity outcomes.
- Operations surfaces increasingly embed continuity semantics.
- Remaining risk is taxonomy fragmentation (same concept expressed under multiple route names).

## 6. Critical Missing or Under-Specified Layers (From Canonical Lens)

### 6.1 Communications continuity

Status: Mostly present.

- Communications UI/API are mature.
- Needed next step is explicit framing of communications as continuity substrate, not only campaign mechanics.

### 6.2 Search / knowledge reconstruction

Status: Partial.

- Search APIs exist.
- Dedicated continuity-reconstruction UX namespace is not explicit.

### 6.3 Role continuity maps

Status: Partial.

- Onboarding and governance provide pieces.
- Explicit role continuity map route family is not clearly surfaced.

### 6.4 Tasking / follow-through continuity

Status: Partial.

- Work and priorities exist.
- Follow-through continuity semantics are not normalized as a distinct canonical module.

### 6.5 Evidence chain visibility

Status: Partial.

- Evidence and timeline endpoints exist in cases and claims.
- Dedicated evidence-chain route taxonomy is not canonicalized.

## 7. Stabilization Actions (Recommended)

### 7.1 Namespace normalization layer (highest priority)

Introduce canonical aliases (or route-group rewrites) while preserving existing URLs:

1. OCI: `/[locale]/oci/*` mapped to current continuity-assessment and continuity-risk surfaces.
2. OCRA: `/[locale]/ocra/*` mapped to continuity intelligence surfaces.
3. Operations Core families: `/[locale]/work/*`, `/[locale]/investigations/*`, `/[locale]/continuity/*`, `/[locale]/onboarding/*` mapped to existing dashboard pages.
4. Governance continuity and institutional intelligence canonical families as semantic aliases.

### 7.2 API ontology adapters

Add canonical API aliases without breaking existing contracts:

1. `/api/oci/*` adapter routes.
2. `/api/ocra/*` contract harmonization to canonical subdomains where feasible.
3. Continuity-focused API families for reconstruction, evidence chains, and role continuity maps.

### 7.3 Single source-of-truth matrix

Create one authoritative machine-readable map:

1. canonical module
2. canonical route
3. runtime route(s)
4. canonical API
5. runtime API(s)
6. gate policy
7. tier inclusion
8. buyer and GTM motion

This should become a validator input (similar to runtime authority checks).

## 8. Final Ontology Stabilization Verdict

Union Eyes already operates as continuity-aware institutional infrastructure in practice. The remaining work is architecture-language consolidation, not conceptual reinvention.

The moat remains valid if and only if we complete namespace and contract stabilization so that:

- OCI/OCRA are never detached from operations runtime.
- Operations surfaces are never detached from continuity semantics.
- Gates, pricing tiers, and GTM motions map to the same canonical continuity model.

In short: **the operating model is coherent; the ontology now needs hard canonicalization at route and API naming layers.**

## 9. Phase 1 Implementation Snapshot (Shipped)

The first semantic stabilization layer is now implemented without destructive rewrites.

### 9.1 Canonical route aliases

- `OCI`: [app/[locale]/oci/page.tsx](../../../../../apps/union-eyes/app/[locale]/oci/page.tsx#L1)
- `OCRA`: [app/[locale]/ocra/page.tsx](../../../../../apps/union-eyes/app/[locale]/ocra/page.tsx#L1)
- `Operations / Grievances`: [app/[locale]/operations/grievances/page.tsx](../../../../../apps/union-eyes/app/[locale]/operations/grievances/page.tsx#L1)
- `Governance Continuity`: [app/[locale]/governance-continuity/page.tsx](../../../../../apps/union-eyes/app/[locale]/governance-continuity/page.tsx#L1)

### 9.2 API ontology adapters (OCI -> existing OCRA runtime)

- [app/api/oci/intake/route.ts](../../../../../apps/union-eyes/app/api/oci/intake/route.ts#L1)
- [app/api/oci/assessment/route.ts](../../../../../apps/union-eyes/app/api/oci/assessment/route.ts#L1)
- [app/api/oci/results/[id]/route.ts](../../../../../apps/union-eyes/app/api/oci/results/[id]/route.ts#L1)
- [app/api/oci/report/[assessmentId]/route.ts](../../../../../apps/union-eyes/app/api/oci/report/[assessmentId]/route.ts#L1)

### 9.3 Ontology governance artifact and validator

- Matrix: [config/continuity-ontology-matrix.json](../../../../../apps/union-eyes/config/continuity-ontology-matrix.json#L1)
- Validator: [scripts/validate-ontology-matrix.ts](../../../../../apps/union-eyes/scripts/validate-ontology-matrix.ts#L1)
- Script hook: [apps/union-eyes/package.json](../../../../../apps/union-eyes/package.json#L1) (`validate:ontology`)

### 9.4 Validation results

- `pnpm --filter @nzila/union-eyes validate:ontology` -> PASS
- `pnpm --filter @nzila/union-eyes typecheck` -> PASS

## 10. Phase 2 Implementation Snapshot (Shipped)

Phase 2 starts UX ontology convergence without route churn.

### 10.1 Ontology-aware navigation labels (transitional)

Role-centric sidebar labels are now mapped to canonical layer semantics while preserving existing destinations:

- Navigation source: [lib/dashboard/role-experience.ts](../../../../../apps/union-eyes/lib/dashboard/role-experience.ts#L1)
- E2E label contract update: [e2e/helpers/role-fixtures.ts](../../../../../apps/union-eyes/e2e/helpers/role-fixtures.ts#L1)

Examples:

- `Casework Console` -> `Operations (Casework Console)`
- `Executive Overview` -> `OCRA Intelligence (Executive Overview)`
- `Governance Overview` -> `Governance Continuity Overview`

### 10.2 Ontology matrix governance scope expansion

The matrix now governs additional domains beyond route and API mapping:

- `navLabels`
- `featureGates`
- `pricingTiers`
- `docsReferences`
- `procurementLanguage`
- `visibilityRules`

Artifacts:

- Matrix v1.1.0: [config/continuity-ontology-matrix.json](../../../../../apps/union-eyes/config/continuity-ontology-matrix.json#L1)
- Validator (expanded checks): [scripts/validate-ontology-matrix.ts](../../../../../apps/union-eyes/scripts/validate-ontology-matrix.ts#L1)

### 10.3 Verification constraints

Type-level and ontology validations pass.

Full Playwright role-nav execution remains environment-blocked in this workspace due:

- missing local DB connectivity (`localhost:5432`)
- missing required runtime env variables
- missing Playwright browser binary installation

These are environment constraints, not evidence of route or type regressions in the shipped changes.

## 11. P1/P2 Completion Delta

### 11.1 Canonical alias families expanded (Operations + Continuity + Onboarding)

Additional canonical UI aliases are now live:

- [app/[locale]/operations/investigations/page.tsx](../../../../../apps/union-eyes/app/[locale]/operations/investigations/page.tsx#L1)
- [app/[locale]/continuity/docs/page.tsx](../../../../../apps/union-eyes/app/[locale]/continuity/docs/page.tsx#L1)
- [app/[locale]/continuity/inheritance/page.tsx](../../../../../apps/union-eyes/app/[locale]/continuity/inheritance/page.tsx#L1)
- [app/[locale]/continuity/archives/page.tsx](../../../../../apps/union-eyes/app/[locale]/continuity/archives/page.tsx#L1)
- [app/[locale]/onboarding/page.tsx](../../../../../apps/union-eyes/app/[locale]/onboarding/page.tsx#L1)
- [app/[locale]/onboarding/survivability/page.tsx](../../../../../apps/union-eyes/app/[locale]/onboarding/survivability/page.tsx#L1)
- [app/[locale]/onboarding/transfers/page.tsx](../../../../../apps/union-eyes/app/[locale]/onboarding/transfers/page.tsx#L1)

Additional canonical API aliases are now live:

- Investigations:
	[app/api/investigations/route.ts](../../../../../apps/union-eyes/app/api/investigations/route.ts#L1),
	[app/api/investigations/evidence/route.ts](../../../../../apps/union-eyes/app/api/investigations/evidence/route.ts#L1),
	[app/api/investigations/timeline/route.ts](../../../../../apps/union-eyes/app/api/investigations/timeline/route.ts#L1),
	[app/api/investigations/audit/route.ts](../../../../../apps/union-eyes/app/api/investigations/audit/route.ts#L1)
- Continuity:
	[app/api/continuity/docs/route.ts](../../../../../apps/union-eyes/app/api/continuity/docs/route.ts#L1),
	[app/api/continuity/inheritance/route.ts](../../../../../apps/union-eyes/app/api/continuity/inheritance/route.ts#L1),
	[app/api/continuity/archives/route.ts](../../../../../apps/union-eyes/app/api/continuity/archives/route.ts#L1)
- Onboarding:
	[app/api/onboarding/transfers/route.ts](../../../../../apps/union-eyes/app/api/onboarding/transfers/route.ts#L1),
	[app/api/onboarding/readiness/route.ts](../../../../../apps/union-eyes/app/api/onboarding/readiness/route.ts#L1)
- Canonical layer roots:
	[app/api/governance/route.ts](../../../../../apps/union-eyes/app/api/governance/route.ts#L1),
	[app/api/intelligence/route.ts](../../../../../apps/union-eyes/app/api/intelligence/route.ts#L1)

### 11.2 Live route registry drift validation (shipped)

The ontology governance stack now includes live runtime drift checking:

- Route registry generator (enhanced method detection):
	[scripts/generate-route-registry.ts](../../../../../apps/union-eyes/scripts/generate-route-registry.ts#L1)
- Drift validator:
	[scripts/validate-ontology-registry-drift.ts](../../../../../apps/union-eyes/scripts/validate-ontology-registry-drift.ts#L1)
- Matrix v1.2.0:
	[config/continuity-ontology-matrix.json](../../../../../apps/union-eyes/config/continuity-ontology-matrix.json#L1)

Validation results:

- `pnpm --filter @nzila/union-eyes registry:generate` -> PASS
- `pnpm --filter @nzila/union-eyes validate:ontology` -> PASS
- `pnpm --filter @nzila/union-eyes validate:ontology:registry` -> PASS
- `pnpm --filter @nzila/union-eyes typecheck` -> PASS

## 12. Phase 3 Governance Hardening (Shipped)

Phase 3 closes the next maturity gate: ontology policy is now enforced against runtime access control and documentation language continuity.

### 12.1 Ontology-derived gating validation

The matrix now defines explicit domain-level gating policy (allowed dashboard experiences + route prefix ownership):

- Matrix v1.3.0 policy source: [config/continuity-ontology-matrix.json](../../../../../apps/union-eyes/config/continuity-ontology-matrix.json#L1)
- Runtime access control source: [lib/dashboard/role-experience.ts](../../../../../apps/union-eyes/lib/dashboard/role-experience.ts#L1)
- Validator: [scripts/validate-ontology-gating.ts](../../../../../apps/union-eyes/scripts/validate-ontology-gating.ts#L1)

This ensures declared ontology domains cannot drift away from real role-access prefixes without CI-visible failure.

### 12.2 Matrix-to-docs semantic drift validation

The matrix now defines mandatory documentation references and required canonical terms:

- Matrix references: [config/continuity-ontology-matrix.json](../../../../../apps/union-eyes/config/continuity-ontology-matrix.json#L1)
- Validator: [scripts/validate-ontology-docs.ts](../../../../../apps/union-eyes/scripts/validate-ontology-docs.ts#L1)

This introduces machine enforcement for procurement and doctrinal continuity language alignment with the canonical ontology.

### 12.3 Governance script integration

Union Eyes package scripts now expose governance checks as first-class pipeline commands:

- Script hooks: [apps/union-eyes/package.json](../../../../../apps/union-eyes/package.json#L1)
- Added commands:
	- `validate:ontology:gating`
	- `validate:ontology:docs`
	- `validate:ontology:full`

Validation results:

- `pnpm --filter @nzila/union-eyes registry:generate` -> PASS
- `pnpm --filter @nzila/union-eyes validate:ontology:full` -> PASS
- `pnpm --filter @nzila/union-eyes typecheck` -> PASS

## 13. Phase 4 Constitutional Stabilization (Shipped)

Phase 4 introduces doctrine-level controls for semantic dictionary governance and ontology-driven navigation composition readiness.

### 13.1 Governed semantic dictionary

Union Eyes now includes a constitutional semantic dictionary as a machine-validated governance artifact:

- Dictionary artifact: [docs/categories/products-and-market/union-eyes/runtime-authority-audit/constitutional-semantic-dictionary.md](../runtime-authority-audit/constitutional-semantic-dictionary.md#L1)
- Matrix source of truth: [config/continuity-ontology-matrix.json](../../../../../apps/union-eyes/config/continuity-ontology-matrix.json#L1)
- Validator: [scripts/validate-ontology-dictionary.ts](../../../../../apps/union-eyes/scripts/validate-ontology-dictionary.ts#L1)

Canonical terms now governed include:

- Continuity
- Governance Continuity
- Institutional Intelligence
- Survivability
- Continuity-aware Operations
- Governance-safe AI
- Operational Inheritance
- Reconstruction Burden
- Stewardship Concentration

This is the first enforceable layer of doctrine governance (not only reference checks).

### 13.2 Ontology-driven nav composition validation

A nav-composition policy is now encoded in the ontology matrix and validated against runtime role navigation:

- Policy source: [config/continuity-ontology-matrix.json](../../../../../apps/union-eyes/config/continuity-ontology-matrix.json#L1) (`navComposition`)
- Runtime nav source: [lib/dashboard/role-experience.ts](../../../../../apps/union-eyes/lib/dashboard/role-experience.ts#L1)
- Validator: [scripts/validate-ontology-nav.ts](../../../../../apps/union-eyes/scripts/validate-ontology-nav.ts#L1)

This enforces that role navigation groups map to canonical ontology domains and remain compatible with doctrine-derived access policy.

### 13.3 Constitutional governance suite expansion

The ontology CI gate now runs six controls:

1. Matrix structural integrity
2. Matrix ↔ live registry drift
3. Matrix ↔ role-access drift
4. Matrix ↔ docs semantic drift
5. Matrix ↔ semantic dictionary integrity
6. Matrix ↔ nav composition policy drift

Script hooks:

- [apps/union-eyes/package.json](../../../../../apps/union-eyes/package.json#L1)
	- `validate:ontology:dictionary`
	- `validate:ontology:nav`
	- `validate:ontology:full` (expanded)

Validation results:

- `pnpm --filter @nzila/union-eyes validate:ontology:full` -> PASS
- `pnpm --filter @nzila/union-eyes typecheck` -> PASS

## 14. Phase 5 Constitutional Anti-Pattern Intelligence (Shipped)

Phase 5 adds warning-first constitutional linting and formal ontology constitution freeze scaffolding.

### 14.1 Warning-first semantic anti-pattern intelligence

Union Eyes now runs a doctrine anti-pattern scan in `warn` mode (non-blocking):

- Policy source: [config/continuity-ontology-matrix.json](../../../../../apps/union-eyes/config/continuity-ontology-matrix.json#L1) (`antiPatternIntelligence`)
- Validator: [scripts/validate-ontology-antipatterns.ts](../../../../../apps/union-eyes/scripts/validate-ontology-antipatterns.ts#L1)
- Script hook: [apps/union-eyes/package.json](../../../../../apps/union-eyes/package.json#L1) (`validate:ontology:antipatterns`)

This explicitly follows proportional governance hardening:

- Phase A: warning only (current)
- Phase B: CI visibility
- Phase C: protected-domain hard fail
- Phase D: full constitutional enforcement

### 14.2 Ontology Constitution v1.0 freeze scaffold

Union Eyes now records a formal constitutional baseline for frozen ontology domains:

- Constitution artifact: [docs/categories/products-and-market/union-eyes/runtime-authority-audit/ontology-constitution-v1.md](ontology-constitution-v1.md#L1)
- Matrix constitutional metadata: [config/continuity-ontology-matrix.json](../../../../../apps/union-eyes/config/continuity-ontology-matrix.json#L1) (`constitution`)

Frozen-domain changes are now explicitly treated as constitutional amendments rather than routine refactors.

## 15. Phase 6 Warning Inventory and Severity Calibration (Shipped)

Phase 6 adds warning telemetry and classification calibration while preserving non-blocking anti-pattern enforcement.

### 15.1 Anti-pattern warning inventory

Union Eyes now generates machine-readable anti-pattern telemetry across docs, pricing semantics, and nav labels:

- Inventory generator: [scripts/generate-ontology-antipattern-inventory.ts](../../../../../apps/union-eyes/scripts/generate-ontology-antipattern-inventory.ts#L1)
- Script hook: [apps/union-eyes/package.json](../../../../../apps/union-eyes/package.json#L1) (`ontology:antipatterns:inventory`)
- Output artifacts:
	- [apps/union-eyes/reports/ontology-antipattern-inventory.json](../../../../../apps/union-eyes/reports/ontology-antipattern-inventory.json#L1)
	- [apps/union-eyes/reports/ontology-antipattern-inventory.md](../../../../../apps/union-eyes/reports/ontology-antipattern-inventory.md#L1)

### 15.2 Severity and classification calibration

Anti-pattern governance now includes explicit calibration classes and phased enforcement metadata:

- `harmless-legacy-language`
- `transitional-acceptable-language`
- `risky-saas-drift`
- `surveillance-adjacent-language`
- `doctrine-violation`

The policy remains proportional:

- mode: `warn`
- per-rule `classification`
- per-rule `enforcementPhase` (`A` to `D`)

This creates CI visibility and promotion-candidate signal without immediate gate hardening.

## 16. Phase 7 Semantic Observability Baseline (Shipped)

Phase 7 operationalizes the stabilized governance stack as internal telemetry rather than additional enforcement.

### 16.1 Internal observability baseline

Union Eyes now generates a baseline report from the anti-pattern inventory for governance stewards:

- Generator: [scripts/generate-semantic-observability-baseline.ts](../../../../../apps/union-eyes/scripts/generate-semantic-observability-baseline.ts#L1)
- Script hook: [apps/union-eyes/package.json](../../../../../apps/union-eyes/package.json#L1) (`observability:semantic`)
- Generated outputs:
	- [apps/union-eyes/reports/semantic-observability-baseline.json](../../../../../apps/union-eyes/reports/semantic-observability-baseline.json#L1)
	- [apps/union-eyes/reports/semantic-observability-baseline.md](../../../../../apps/union-eyes/reports/semantic-observability-baseline.md#L1)

### 16.2 Telemetry intent

This baseline is designed to make semantic governance observable without adding a new hard gate. It is the internal reference point for:

- semantic drift rate
- SaaS-language reintroduction risk
- surveillance-adjacent language risk
- procurement/runtime divergence risk
- nav/domain divergence risk
- constitutional amendment pressure over time

### 16.3 Current posture

The current inventory remains at zero matches across 185 scanned sources, which is a meaningful stabilization signal rather than a conclusion of perfection.

Validation result:

- `pnpm --filter @nzila/union-eyes observability:semantic` -> PASS
