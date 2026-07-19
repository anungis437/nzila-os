# Institutional Intelligence Product Qualification Matrix

<!--
  ARTIFACT TYPE: GTM Routing Control Standard
  DOCTRINE_VERSION: 1.1.0-draft
  CHANGE CLASS: Constitutional GTM control - founder sign-off required.
  CANONICAL REFERENCE: docs/doctrine/INSTITUTIONAL_INTELLIGENCE_CANONICAL_PACKAGE.md
  ARCHITECTURE REFERENCE: docs/doctrine/programs/INSTITUTIONAL_INTELLIGENCE_PRODUCT_ARCHITECTURE.md
-->

> Purpose: enforce consistent route decisions across all discovery and proposal workflows.
> This matrix is mandatory before issuing any proposal or SOW.

---

## 1. Scoring Model

Score only evidence-backed signals observed in discovery.

Use this scale for each signal:
- 0 = Not present
- 1 = Weak signal
- 2 = Clear signal

Weighted contribution = signal score x route weight.

---

## 2. Qualification Signals and Weights

| Signal | Weight | Route bucket |
|---|---:|---|
| Leadership transition risk | +3 | IIA |
| Governance inconsistency | +3 | IIA |
| Executive trust issues | +3 | IIA |
| Institutional memory loss risk | +2 | IIA |
| Board/executive accountability ambiguity | +2 | IIA |
| Grievance backlog | +3 | Union Eyes |
| Steward workflow failure | +3 | Union Eyes |
| Member service inconsistency | +2 | Union Eyes |
| Officer-transition continuity gaps | +2 | Union Eyes |
| Bargaining memory loss | +2 | Union Eyes |
| SMB governance controls gap | +3 | TrustCore |
| Compliance readiness weakness | +2 | TrustCore |
| Policy/control operating inconsistency (SMB) | +2 | TrustCore |

---

## 3. Route Scorecard

| Route | Formula |
|---|---|
| IIA score | Sum of weighted IIA signals |
| Union Eyes score | Sum of weighted Union Eyes signals |
| TrustCore score | Sum of weighted TrustCore signals |

Record:
- IIA score =
- Union Eyes score =
- TrustCore score =

---

## 4. Deterministic Route Logic

Apply rules in order:

1. If max(IIA, Union Eyes, TrustCore) < 5 -> Defer / not fit.
2. If IIA score >= Union Eyes score + 3 AND IIA score >= TrustCore score + 3 -> IIA-first.
3. If Union Eyes score >= IIA score + 3 AND Union Eyes score >= TrustCore score + 3 -> Union Eyes-first.
4. If TrustCore score >= IIA score + 3 AND TrustCore score >= Union Eyes score + 3 -> TrustCore route.
5. If abs(IIA score - Union Eyes score) <= 2 AND max(IIA score, Union Eyes score) >= 5 -> Hybrid: IIA -> Union Eyes.
6. Otherwise -> Architecture review required before proposal issuance.

---

## 5. Tie-Break and Escalation Rules

Use these only after deterministic logic:

1. If IIA and TrustCore are within 2 points and both >= 5:
   - choose IIA-first when executive transition/trust signals dominate.
   - choose TrustCore route when SMB compliance/control signals dominate.
2. If Union Eyes and TrustCore are within 2 points and both >= 5:
   - escalate for architecture review (cross-domain ambiguity).
3. Any route override requires written justification and approval.

---

## 6. Governance Requirements

1. Matrix completion is mandatory for every qualified opportunity.
2. Proposal and SOW must include matrix score summary and selected route.
3. Route decisions must be archived in a Route Decision Record.
4. Deviations from matrix logic require approval and documented rationale.

---

## 7. Worked Example (CUPE-style mixed signal)

Observed signals:
- Grievance backlog: clear (2)
- Steward workflow failure: clear (2)
- Member service inconsistency: weak (1)
- Leadership transition risk: weak (1)
- Governance inconsistency: weak (1)

Scores:
- IIA = (1x3) + (1x3) = 6
- Union Eyes = (2x3) + (2x3) + (1x2) = 14
- TrustCore = 0

Decision:
- Union Eyes-first (Union Eyes exceeds IIA by 8 points)

---

## 8. Control Intent

This matrix converts routing from intuition to institutional process.

The objective is repeatability:
- same evidence -> same score
- same score -> same route
- same route -> coherent proposal architecture
