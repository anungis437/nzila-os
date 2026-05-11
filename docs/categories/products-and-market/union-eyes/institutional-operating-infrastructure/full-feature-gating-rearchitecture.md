# Full Feature-Gating Rearchitecture

> Refactor gating around operational maturity, not feature counts.

## 1. Convergence Statement

UE gating must increasingly feel **institutionally intentional**: tiers reflect operational maturity, not arbitrary SaaS feature gates.

## 2. Maturity-Based Gating Axes

Refactor gating toward:

- continuity maturity
- governance maturity
- executive maturity
- cadence maturity
- stewardship maturity
- institutional memory maturity
- federation maturity
- operational proving maturity
- procurement maturity

## 3. Gating Model

| Tier | Continuity | Governance | Executive | Cadence | Stewardship | Memory | Federation | Proving | Procurement |
|------|-----------|-----------|-----------|---------|-------------|--------|-----------|---------|-------------|
| Institutional Continuity Core | ✅ | basic | — | basic | basic | basic | — | — | basic |
| Governance & Continuity Operations | ✅ | ✅ | basic | ✅ | ✅ | ✅ | — | basic | ✅ |
| Institutional Operating Infrastructure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Institutional Sovereignty Layer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (multi-org) | ✅ | ✅ (sovereign) |

## 4. Implementation Discipline

Runtime gating refactor (entitlement keys, route guards, navigation visibility, cognition-surface access) is doctrinally specified here. Live gating-component edits roll into dedicated follow-on PRs to preserve CI and entitlement-test stability.

## 5. Refactor Targets

- runtime visibility
- navigation visibility
- module access
- cognition access
- governance access
- onboarding access
- operational review access

## 6. Anti-Patterns

Avoid:

- per-feature SKU multiplication
- AI-feature gating
- engagement-based gating
- usage-quantity gating as primary axis

## 7. Authority

Anchored to [Full Monetization Rearchitecture](full-monetization-rearchitecture.md) and [UE Operating System Reclassification](ue-operating-system-reclassification.md).
