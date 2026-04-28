# AI Rollout Playbook

**Doc ID:** AI-ROLL-2026-001
**Owner:** AI Lead
**Use:** Step-by-step playbook for taking a new AI capability from idea to production at Nzila.
**Methodology source:** Info-Tech "Operational Framework for Rolling Out AI"

## Stage gates

```
1. IDEATE  →  2. SCOPE  →  3. CLASSIFY  →  4. DESIGN  →  5. BUILD  →  6. EVAL  →  7. APPROVE  →  8. LAUNCH  →  9. OPERATE  →  10. RETIRE
```

Each stage produces tangible artifacts.

## 1. IDEATE

- Surface Owner files a brief: problem, target user, success metric, hypothesis that AI helps.
- Confirm the problem is best solved by AI (vs deterministic logic).

## 2. SCOPE

- Determine data tiers in/out (link to [`../privacy/policies/data-classification-standard.md`](../privacy/policies/data-classification-standard.md))
- Identify provider / model candidates
- Identify users / data subjects affected
- Sketch the human-in-the-loop pattern (or argue why none needed)

## 3. CLASSIFY

- Apply [risk-classification.md](risk-classification.md) §2 rubric
- Record provisional tier in inventory

## 4. DESIGN

- Architecture: integration through `packages/platform-cognition-core` / `packages/ue-cognition`
- Reasoning context envelope shape
- Prompt templates (versioned)
- Retrieval / grounding pattern
- Output validation (schema, allow-list, content filter)
- Kill switch / feature flag
- Cost / token budget
- Telemetry plan
- Eval plan (regression set, bias panel for Tier ≤ 2 user-facing, adversarial)

## 5. BUILD

- Implement behind feature flag (off in prod)
- Wire envelope + telemetry
- Author eval suite under surface package `evals/`
- Update [inventory.md](inventory.md)
- Draft per-surface PIA (use [`../privacy/ai-pia/template.md`](../privacy/ai-pia/template.md))

## 6. EVAL

- Run eval suite locally + CI
- For Tier 2/1: bias panel + adversarial corpus
- For Tier 1: full conformity dossier (G11)
- Capture baseline metrics; thresholds defined

## 7. APPROVE

- Tier 3: Surface Owner sign-off
- Tier 2: Privacy Lead + Surface Owner
- Tier 1: AIGC quorum (per [governance-committee-charter.md](governance-committee-charter.md))
- Approval recorded in inventory + minutes

## 8. LAUNCH

- Enable feature flag for staged cohort (canary 1% → 10% → 50% → 100% over the rollout window)
- "AI assisted" / "AI generated" disclosure live in UI
- On-call paged for any drift / cost / error breach
- Customer notice if customer-facing change

## 9. OPERATE

- Heightened observation 30 days
- Weekly sampling review
- Monthly AIGC report from [assurance-program.md](assurance-program.md)
- Re-classification on any material change

## 10. RETIRE

- Sunset notice to users
- DSAR window honored before takedown
- Inventory row marked RETIRED
- Logs retained per retention schedule
- Eval suite archived

## Per-stage RACI

| Stage | Surface Owner | AI Lead | Privacy Lead | Security Lead | AIGC |
|-------|:-------------:|:-------:|:------------:|:-------------:|:----:|
| 1. IDEATE | R | A | C | C | I |
| 2. SCOPE | R | A | C | C | I |
| 3. CLASSIFY | R | A | C | C | I |
| 4. DESIGN | R | A | C | C | I |
| 5. BUILD | R | A | C | C | I |
| 6. EVAL | R | A | C | C | I |
| 7. APPROVE | R | C | A (T2+) | A (T1) | A (T1) |
| 8. LAUNCH | R | A | I | I | I |
| 9. OPERATE | R | A | C | C | I (monthly review) |
| 10. RETIRE | R | A | C | I | I |

R=Responsible · A=Accountable · C=Consulted · I=Informed
