# Live Cross-App Convergence Implementation

> **Status:** Canonical convergence · **Layer:** Implementation · **Inherits:** [README.md](README.md)

## 1. Objective

Actually implement convergence across the apps — not by cloning UE, but by harmonizing the ecosystem around the canonical contract.

## 2. Required implementation

### 2.1 Canonical contract package

Ship [`@nzila/operational-convergence`](../../packages/operational-convergence) exporting:

- `CANONICAL_GROUPS`, `CANONICAL_ROUTE_SEGMENTS`
- `CANONICAL_GLOSSARY`, `defineTerm(term)`
- `CANONICAL_ROLES`, `getRoleExperience(role)`
- `CANONICAL_REVIEW_WORKFLOWS`
- `CANONICAL_CADENCE`, `cadenceFor(domain)`
- `buildCanonicalSidebar(role, productOverlay?)`
- `getCanonicalIATree()`, `getCanonicalOperatorPathway()`
- `getGovernanceEmbodimentChecklist()`
- `executiveSurfaceContract(surfaceId)`

### 2.2 App bindings

Each consuming app exposes a thin binding under `lib/operational-convergence/index.ts` so the rest of the app imports from `@/lib/operational-convergence` only. This keeps every app on the same upgrade path:

- [apps/control-plane/lib/operational-convergence/index.ts](../../apps/control-plane/lib/operational-convergence/index.ts)
- [apps/console/lib/operational-convergence/index.ts](../../apps/console/lib/operational-convergence/index.ts)
- [apps/union-eyes/lib/operational-convergence/index.ts](../../apps/union-eyes/lib/operational-convergence/index.ts)

### 2.3 Navigation harmonization

Each app composes its sidebar via `buildCanonicalSidebar(role)`. Product-specific children live inside a canonical group; new top-level groups are refused.

### 2.4 Review workflow harmonization

Each app's review surfaces consume the canonical workflow registry and the shared `DecisionLedger` shape. Per-app ledger shapes are refused.

### 2.5 Cadence harmonization

Each app reads cadence from `cadenceFor(domain)` and never hard-codes refresh intervals locally.

## 3. Refused implementation

- Cloning UE layouts blindly.
- Cross-app component imports (each app keeps its own RSCs).
- Per-app divergent role keys, glossary terms, or workflow names.

## 4. Discipline

Live convergence succeeds when no app introduces a new operational concept without first promoting it into the canonical contract.
