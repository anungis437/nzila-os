# 24-Month Operating Scenario

**Report type**: Investor scenario planning  
**Classification**: All monetary figures are `scenario` or `forecast` unless explicitly marked `actual`. See [tooling/truth/metric-schema.ts](../../tooling/truth/metric-schema.ts) for classification definitions.  
**Reference docs**: [docs/investor/revenue-scenarios.md](../../docs/investor/revenue-scenarios.md), [docs/investor/three-year-growth-narrative.md](../../docs/investor/three-year-growth-narrative.md), [reports/portfolio-forecast.json](../portfolio-forecast.json)  
**Last updated**: 2026-04-22  

---

> **Investor notice**: This document presents internally modeled operating scenarios. No figures in this document represent booked revenue, committed investment, or audited financial statements. All projections carry execution risk. The company makes no warranty that any scenario will be achieved.

---

## Current State (Month 0 Baseline)

| Metric | Value | Classification |
|---|---|---|
| Active paid contracts | 0 | `actual` |
| Active pilots | 1 | `actual` |
| Pilots in negotiation | 2 | `estimated` |
| Baseline runway | ~6.8 months | `estimated` |
| Monthly burn | ~$50K–$65K CAD (founder + infra) | `estimated` |
| Azure monthly infra cost | ~$800–$1,200 CAD | `estimated` |
| Annual infrastructure ceiling (staging) | < $15K CAD | `estimated` |

**Narrative**: The company has one active Union Eyes pilot underway and two additional pilots in negotiation. No SaaS revenue has been booked. Burn is founder-stage with infrastructure costs well under $15K annually. The capital constraint is real — the next 6–9 months are the conversion window.

---

## Scenario Architecture

Three scenarios are modeled across 24 months. All assume:

- Primary product: Union Eyes (labour union grievance + case management)
- Pricing: $12K CAD pilot → $4,500/month CAD ongoing (confirmed pricing framework)
- Secondary products: Flow, ABR — contribute to upside only; not modelled in Base or Conservative
- Gross margin: ~80% at scale (SaaS + minimal variable infra cost)
- Headcount: founder + 1 contractor equivalent through Month 12; +1 FTE customer success at Month 15 (Base/Upside only)

---

## Conservative Scenario — Stall and Survive

**Thesis**: Pilots fail to convert. Execution friction delays revenue. Company survives to Month 24 only with capital injection.

| Milestone | Month | Revenue (CAD) | Classification |
|---|---|---|---|
| Pilot 1 converts to paid | Not achieved | — | `scenario` |
| Pilot 2 converts | Not achieved | — | `scenario` |
| ARR at Month 12 | $0–$10K | `scenario` |
| ARR at Month 24 | ~$35K–$55K (1–2 small contracts) | `scenario` |
| Capital needed M0→M24 | ~$800K CAD | `scenario` |
| Survival probability (no new capital) | Low — sub-12 months runway without raise | `scenario` |

**Key risks**:

- Union procurement cycles average 6–12 months; pilots don't compress this
- Executive sponsor changes within the union during pilot
- Platform maturity gaps (SOC 2, pen test) block IT approval

**Decision gate**: If Month 9 shows 0 pilot conversions, trigger portfolio consolidation review.

---

## Base Scenario — Disciplined Conversion

**Thesis**: 2 pilots convert to paid contracts by Month 8. Third pilot secured by Month 12. Flow reaches first paid contract Month 18.

| Milestone | Month | Revenue (CAD) | Classification |
|---|---|---|---|
| Pilot 1 → paid ($4,500/mo) | M6 | +$4,500/mo | `forecast` |
| Pilot 2 → paid ($4,500/mo) | M8 | +$4,500/mo | `forecast` |
| New pilot signed (Local 3) | M10 | $12K pilot fee | `forecast` |
| ARR at Month 12 | ~$108K–$130K CAD | `forecast` |
| Pilot 3 converts | M14 | +$4,500/mo | `forecast` |
| Flow: first paid contract | M18 | +$3,000–$6,000/mo | `scenario` |
| ARR at Month 24 | ~$180K–$230K CAD | `forecast` |
| Capital needed M0→M24 | ~$400K–$600K CAD | `scenario` |
| Gross margin at M24 | ~78–82% | `estimated` |

**Quarterly ARR progression (Base)**:

| Quarter | ARR (CAD) | Notes | Classification |
|---|---|---|---|
| Q1 2026 (M0–M3) | $0 | Pilot ongoing — no conversion yet | `scenario` |
| Q2 2026 (M4–M6) | $54K | Pilot 1 converts M6 | `forecast` |
| Q3 2026 (M7–M9) | $108K | Pilot 2 converts M8 | `forecast` |
| Q4 2026 (M10–M12) | $108K–$130K | Pilot 3 in progress; $12K pilot fee in Q4 | `forecast` |
| Q1 2027 (M13–M15) | $130K–$160K | Pilot 3 converts | `forecast` |
| Q2 2027 (M16–M18) | $160K–$200K | Flow first contract + Union Eyes expansion | `scenario` |
| Q3 2027 (M19–M21) | $180K–$220K | Steady state 3–4 Union Eyes contracts | `forecast` |
| Q4 2027 (M22–M24) | $180K–$230K | Flow traction + possible ABR pilot | `scenario` |

**Decision gates**:

- M6: If 0 conversions → revert to Conservative scenario; freeze Flow investment
- M12: If ARR < $80K → fundraise immediately; do not proceed to Flow investment
- M18: If ARR > $150K → begin structured fundraise at Series Seed terms

---

## Upside Scenario — Breakout

**Thesis**: 3 pilots convert rapidly. National union partnership opens a multi-local contract. Flow and ABR each reach first paid contracts within 18 months.

| Milestone | Month | Revenue (CAD) | Classification |
|---|---|---|---|
| Pilot 1 → paid | M4 | +$4,500/mo | `scenario` |
| National partner agreement (multi-local) | M6 | +$15K–$25K/mo | `scenario` |
| Pilot 2 → paid | M7 | +$4,500/mo | `scenario` |
| ABR: first paid contract | M12 | +$5,000–$8,000/mo | `scenario` |
| ARR at Month 12 | ~$360K–$550K CAD | `scenario` |
| Flow: first paid contract | M15 | +$4,000–$7,000/mo | `scenario` |
| Expansion revenue (existing accounts) | M18 | +20–30% on base MRR | `scenario` |
| ARR at Month 24 | ~$900K–$1.4M CAD | `scenario` |
| Capital needed (with traction) | $250K–$400K (bridge to Series Seed) | `scenario` |
| Gross margin at M24 | ~82–86% | `scenario` |

**Note**: The upside scenario requires a national union partnership that does not currently exist. It is presented to illustrate market potential, not expected outcomes. All figures marked `scenario`.

---

## Funding Requirements by Scenario

| Scenario | Capital Required M0→M24 | Use of funds | Classification |
|---|---|---|---|
| Conservative | ~$800K CAD | Survival bridge; no growth | `scenario` |
| Base | ~$400–$600K CAD | Operations + 1 CS hire at M15 | `scenario` |
| Upside | ~$250–$400K CAD | Bridge to revenue-funded growth | `scenario` |

**Seed ask (current)**: $300–$500K CAD bridge — sufficient to execute Base scenario through M18 conversion gate.

---

## Key Assumptions and Sensitivities

| Assumption | Base value | Sensitivity |
|---|---|---|
| Pilot-to-paid conversion rate | 67% (2 of 3 pilots) | Each failed conversion = −$54K ARR at M12 |
| Avg contract value (Union Eyes) | $4,500/mo CAD | ±20% depending on local size |
| Pilot fee | $12,000 CAD flat | Firm (confirmed pricing) |
| Sales cycle (pilot to signed) | 3–5 months | Longer for national / multi-local |
| Churn rate (Year 1) | 0% assumed (sticky product, multi-year pain) | First churn event = significant signal |
| Infra cost scaling | Sub-linear; < $3K/month at 20 contracts | Azure Container Apps auto-scale |
| Headcount | 1 FTE CS at M15 (Base); earlier in Upside | Most sensitive to revenue timing |

---

## Milestones That De-Risk the Investment

| Milestone | Why it matters |
|---|---|
| Pilot 1 → paid (target M6) | Proves conversion; validates pricing tolerance |
| Second local signed | Proves repeatability; not single-account dependency |
| IT approval from procurement-sensitive buyer | Validates security posture and trust pack |
| Evidence package used in real arbitration | Proves product value beyond convenience |
| Flow or ABR first contract | Proves platform leverage thesis |

---

## What Investors Should Watch

1. **Conversion velocity** — first paid conversion is the most important leading indicator
2. **Procurement cycle length** — if IT review extends past M8, adjust M12 ARR down
3. **NPS / steward satisfaction** — product stickiness is the moat; churn = existential
4. **Platform team capacity** — founder concentration risk; first hire should be CS/implementation
5. **SOC 2 readiness** — unblocks enterprise deals; actively de-risked with security trust pack

---

*Cross-references*: [docs/investor/revenue-scenarios.md](../../docs/investor/revenue-scenarios.md) | [reports/portfolio-forecast.json](../portfolio-forecast.json) | [reports/capital-scenarios.md](../capital-scenarios.md) | [reports/runway-scenarios.md](../runway-scenarios.md)
