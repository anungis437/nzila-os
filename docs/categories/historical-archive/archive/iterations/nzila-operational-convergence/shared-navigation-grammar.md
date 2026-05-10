# Shared Navigation Grammar

> **Status:** Canonical convergence · **Layer:** Navigation · **Inherits:** [canonical-information-architecture.md](canonical-information-architecture.md)

## 1. Objective

Define the canonical navigation grammar so the sidebar of every Nzila product reads as one institutional grammar.

## 2. Canonical sidebar groups

In display order, top-to-bottom:

1. **Work** — outstanding operator acts.
2. **Priority** — the bounded focus list.
3. **Outcomes** — what the operator is accountable for.
4. **Intelligence** — interpretive read-only surfaces.
5. **Governance** — posture, review, continuity, legitimacy, stabilization.
6. **Rollout** — pacing-bounded change.
7. **Evidence** — content-hash citable material.
8. **Attestations** — signed envelopes.

Each group MAY contain product-specific children, but the group identity is invariant.

## 3. Canonical labels

Group labels MUST match the [shared operational language system](shared-operational-language-system.md). Labels MUST NOT be product-cute (e.g., "My Stuff", "Action Center").

## 4. Required implementation

- A `buildCanonicalSidebar(role, productOverlay)` helper ships in [`@nzila/operational-convergence`](../../packages/operational-convergence).
- Each app composes its sidebar by calling `buildCanonicalSidebar(...)` and only adds product-specific children inside a canonical group.
- Apps MUST NOT introduce a new top-level group without a cited change to this document.

## 5. Role-aware routing

Role-aware visibility uses the canonical role registry from [shared-role-experience-model.md](shared-role-experience-model.md). Apps MUST NOT invent per-app role keys.

## 6. Refused patterns

- Per-app top-level groups that mirror a canonical group under a different name.
- Hidden navigation features behind feature flags.
- Sidebar items that change order on user behavior.

## 7. Discipline

A navigation grammar succeeds when an operator looks at any Nzila sidebar and finds the same institutional shape.
