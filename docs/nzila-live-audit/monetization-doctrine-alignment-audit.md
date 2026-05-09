# 08 — Monetization Doctrine Alignment Audit

**Authority:** Re-evaluation of UE monetization under doctrine convergence.
**Source anchors:**
[docs/nzila-cognition-doctrine/](../nzila-cognition-doctrine/),
[apps/union-eyes/lib/billing/](../../apps/union-eyes/lib/billing/),
`docs/business/`.

---

## 1. Doctrine Constraint

UE monetization MUST honour the institutional cognition doctrine:

- **Continuity over conversion:** revenue tiers must protect institutional
  memory, not unlock optimization features.
- **Governance-safe pricing:** no pricing tier may grant the right to bypass
  governance, escalation, or stewardship constraints.
- **Bounded autonomy:** AI capabilities are NOT pricing differentiators;
  bounded-confidence behavior is universal.
- **No optimization framing:** pricing copy must not promise efficiency,
  productivity, or autonomous capability.

---

## 2. Approved Monetization Axes

Under doctrine, the following axes are **approved** for tier differentiation:

| Axis                              | Tier-able? | Notes                                          |
|-----------------------------------|------------|------------------------------------------------|
| **Continuity** (retention horizon)| YES        | e.g. 1-year vs 5-year vs perpetual archive     |
| **Executive surface**             | YES        | Console executive dashboards / cadence reviews |
| **Cognition depth**               | YES        | Number of bounded-cognition surfaces enabled    |
| **Institutional memory**          | YES        | Evidence pack volume, audit retention, export depth |
| **Stewardship support**           | YES        | Number of stewards seat-licensed               |
| **Pilot scaffolding**             | YES        | Onboarding consulting hours                    |
| Optimization / efficiency         | NO         | Doctrine-prohibited                            |
| Autonomous AI capability          | NO         | Doctrine-prohibited                            |
| Governance bypass                 | NO         | Doctrine-prohibited                            |

---

## 3. Current UE Monetization Surfaces

### 3.1 Pricing tiers (from `apps/union-eyes/lib/billing/`)

| Tier              | Continuity | Executive surface | Cognition surfaces | Memory   | Stewards | Verdict |
|-------------------|------------|-------------------|--------------------|----------|----------|---------|
| `pilot`           | 1 year     | basic             | 1 (CBA intel)      | 100 cases | 5       | LIVE    |
| `union_standard`  | 3 years    | full              | 3                  | 1000 cases | 25     | LIVE    |
| `union_enterprise`| perpetual  | full + cadence    | all                | unlimited | unlimited | LIVE   |

### 3.2 Pricing copy review

| Surface                                | Doctrine-aligned? | Notes                            |
|----------------------------------------|-------------------|----------------------------------|
| `/[locale]/pricing`                    | YES               | "Continuity-tier pricing" framing |
| Hero: "Institutional memory for unions" | YES              | Continuity-first                 |
| CTA: "Protect your collective intelligence" | YES          | Memory-focused                   |
| No mentions of "AI-powered", "automated" | YES (verified)  | `validate:cognition` enforces    |

### 3.3 Verdict

UE monetization is **doctrine-aligned**. All three tiers differentiate on
approved axes (continuity, executive surface, cognition depth, memory,
stewards) and pricing copy avoids prohibited framing.

---

## 4. Cross-app Monetization Posture

| App         | Monetization model            | Doctrine-aligned? | Verdict |
|-------------|-------------------------------|-------------------|---------|
| union-eyes  | Tier-based subscription       | YES               | LIVE    |
| zonga       | Per-creator + payout fee      | YES (creator economy is non-doctrine) | LIVE |
| cfo         | TBD (advisory)                | YES (bounded advisory) | DEFERRED — no live pricing |
| flow        | TBD                           | TBD               | DEFERRED |
| abr         | TBD                           | BLOCKED until FairCase realignment | BLOCKED |
| partners    | Revenue share (no direct billing) | YES           | LIVE    |
| console     | Bundled w/ enterprise UE tier | YES               | LIVE    |
| platform-admin | Internal (no monetization) | N/A               | RESERVED|

---

## 5. Continuity Pricing Validation

The **most novel** doctrine-aligned axis is continuity. Validation:

| Claim                                              | Validated?                       |
|----------------------------------------------------|-----------------------------------|
| `pilot` tier deletes data after 1 year             | DEFERRED — retention policy NOT YET ENFORCED in code |
| `union_standard` retains 3 years                   | DEFERRED — same                   |
| `union_enterprise` retains perpetually             | DEFERRED — same                   |
| Tier downgrade preserves higher-tier data immutably | DEFERRED                         |
| Audit packs survive tier changes                   | LIVE (evidence packs are immutable) |

> **Operational honesty:** Retention enforcement is **DEFERRED**. The pricing
> tier metadata exists; the cleanup cron does NOT. This is the **single
> material gap** in monetization doctrine.

---

## 6. Doctrine Re-evaluation Findings

| Finding                                             | Severity | Mitigation                          |
|-----------------------------------------------------|----------|-------------------------------------|
| Continuity tier retention not enforced in code      | High     | Implement retention cron + audit log |
| `cfo` advisory pricing not yet defined              | Medium   | Define under bounded-advisory framing |
| `abr` pricing blocked pending realignment           | High     | Tracked in FairCase doctrine doc    |
| No operator UI to view continuity-tier obligations  | Medium   | Add tenant-tier dashboard           |
| Pricing copy free of optimization framing           | n/a      | LIVE — `validate:cognition` enforces |

---

## 7. Doctrine Convergence Statement

UE monetization is **structurally aligned** with the cognition doctrine:

- All approved axes are used for differentiation.
- No prohibited axes are present.
- Pricing copy passes `validate:cognition`.
- Evidence packs are immutable across tier changes.

The **single material gap** is enforcement of continuity-tier retention —
documented and tracked.

---

**Verdict for §8:** Monetization is **doctrine-coherent** with one material
deferral (retention enforcement). UE is the only fully-priced surface; other
apps are appropriately deferred or blocked pending their own doctrine
realignments.
