# UnionEyes — AI Governance and Human Oversight

> **Audience:** Procurement reviewers, ethics committees, institutional buyers.
> **Scope:** Public-safe summary of UnionEyes AI governance controls and human oversight mechanisms.
> **Caveats:** Claims use language such as "is designed to," "supports," and "provides evidence of."
> UnionEyes does not make autonomous decisions about member rights, employment status, or
> grievance outcomes.

---

## 1. AI Governance Philosophy

UnionEyes is designed with the principle that AI operations are advisory tools in service
of human decision-making. No AI operation in UnionEyes makes binding decisions about
member matters, grievances, or labour relations outcomes.

**Core principles:**

1. **Human primacy:** All AI outputs are advisory unless a human reviewer explicitly acts on them.
2. **Explainability:** AI operations are classified by risk level and the classification is
   visible to governance actors.
3. **Jurisdiction-aware:** AI autonomy boundaries vary by federation tier. More restricted
   governance contexts receive tighter AI controls.
4. **Simulation-grade foresight:** AI governance scenarios can be simulated before deployment,
   providing institutional preparedness evidence.

---

## 2. AI Risk Classification

All AI operations are classified into one of four risk tiers before execution:

| Risk Tier | Description | Human Review Required |
|-----------|-------------|----------------------|
| `assistive` | Background processing, summarisation | No |
| `advisory` | Recommendations presented to humans | No (advisory only) |
| `sensitive` | Content affecting member records or decisions | Required before action |
| `restricted` | Operations blocked at federation level | Blocked — not executed |

*Supporting evidence:*
- `lib/governance-policy/ai-governance.ts` — AI operation risk classification engine
- `lib/governance-policy/types.ts` — `AIActionRisk` type definition

---

## 3. Human Review Gate

When an AI operation is classified as `sensitive`, it is routed through a human review
workflow before any effect is applied. The human review gate:

- Requires explicit action by an authorised human reviewer.
- Creates an audit record linking the AI recommendation to the human decision.
- Cannot be bypassed without explicit governance escalation.

---

## 4. Federation-Level AI Autonomy Boundaries

AI governance is federation-aware. Each federation tier can declare:

- **Maximum permitted risk level:** The highest risk tier permitted without national oversight.
- **Federated restrictions:** Specific AI operation types restricted at the federation level.
- **Local override permissions:** Whether a local unit may relax federation-level restrictions.

*Supporting evidence:*
- `lib/federation-sovereignty/autonomy.ts` — `resolveAIAutonomyBoundary` function
- `lib/federation-sovereignty/types.ts` — `AIAutonomyBoundary` type

---

## 5. AI Governance Simulation

UnionEyes provides shadow-mode AI governance simulations that model:

- Sensitive AI escalation scenarios
- Human review failure paths
- Federation AI restriction conflicts
- Publication AI governance disputes
- Advisory-to-restricted transition scenarios

These simulations produce evidence without affecting production runtime.

*Supporting evidence:*
- `lib/governance-simulation/ai-simulation.ts` — AI governance simulation module

---

## 6. What AI Does Not Do in UnionEyes

UnionEyes AI features are explicitly constrained:

| AI does NOT do this |
|---------------------|
| Automatically resolve grievances |
| Automatically discipline members |
| Automatically file or close cases |
| Make autonomous employment decisions |
| Override human steward judgment |
| Execute restricted operations without human review |

---

## 7. AI Governance Posture Summary

| Control | Status |
|---------|--------|
| Risk-tiered AI classification | ✅ Present — 4 tiers |
| Human review gate for sensitive operations | ✅ Present |
| Federation-level AI autonomy boundaries | ✅ Present |
| AI governance simulation | ✅ Present (shadow-mode) |
| No autonomous binding decisions | ✅ By design |

---

*See also: [FEDERATION_AND_SOVEREIGNTY_OVERVIEW.md](./FEDERATION_AND_SOVEREIGNTY_OVERVIEW.md)*
