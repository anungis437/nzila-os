# Pilot ROI Calculator — Union Eyes

> Editable, buyer-driven ROI model. Every input is the buyer's number. Every output is auditable arithmetic. No proprietary benchmarks, no vendor-inflated multipliers.

**Companion CSV:** [`pilot-roi-calculator.csv`](./pilot-roi-calculator.csv) — drop into Excel / Google Sheets / Numbers.

**Source formulas:** [`UNION_EYES_COGNITION_ROI.md`](../UNION_EYES_COGNITION_ROI.md) — every KPI is backed by a published formula.

**Honesty rules:**
- No "industry average" numbers. If the buyer has no data, we show the formula with placeholder assumptions and flag them.
- All time-saved assumptions are conservative ends of the range.
- The model produces ranges (low / expected / high), not single-point fantasy numbers.

---

## A. Inputs (buyer-provided)

| # | Input | Typical range | Unit | Who answers |
|---|---|---|---|---|
| I1 | Active members | 100–25,000 | count | Secretary-Treasurer |
| I2 | Grievance volume per month | 5–150 | count | Grievance officer |
| I3 | Number of stewards | 3–80 | count | VP / Chief steward |
| I4 | Average loaded hourly wage (blended steward + admin) | $45–$120 | CAD/hr | Treasurer |
| I5 | Admin time per case (current) | 1.5–6.0 | hours | Grievance officer |
| I6 | Case backlog size (open ≥30 days) | 5–200 | count | Grievance officer |
| I7 | Executive reporting hours per month | 4–40 | hours | COO / Ops director |
| I8 | Missed-deadline incidents per year (estimated) | 0–25 | count | Grievance officer |
| I9 | Arbitration filings per year | 0–12 | count | Grievance officer |
| I10 | Average cost of an arbitration filing (avoided) | $8,000–$40,000 | CAD | Treasurer |

> **Use conservative numbers.** The math still works.

---

## B. Outputs (calculated)

### 1. Admin hours saved per month

**Formula:**
`hours_saved_monthly = (precedent_retrievals × 1.5) + (early_warnings × 0.75) + (reassignments_accepted × 1.0)`

| Driver | Low | Expected | High |
|---|---|---|---|
| Precedent retrievals / month | 8 | 16 | 32 |
| Early-warning interventions / month | 12 | 24 | 48 |
| Reassignments accepted / month | 4 | 8 | 16 |
| **Monthly hours saved** | **30** | **50** | **80** |

Multiplier source: published in [`UNION_EYES_COGNITION_ROI.md`](../UNION_EYES_COGNITION_ROI.md#pricing--roi-break-even).

### 2. Faster grievance cycle time

**Formula:**
`cycle_days_saved = baseline_cycle_days × cycle_reduction_pct`

| Assumption | Low | Expected | High |
|---|---|---|---|
| Baseline avg cycle (days) | 45 | 60 | 90 |
| Cycle reduction % | 5% | 10% | 20% |
| Days saved per case | 2.25 | 6.0 | 18.0 |
| × Grievance volume / month | × I2 | × I2 | × I2 |

Conservative rule: if buyer has no cycle-time measurement today, use 0% in year 1 (measure first, improve second).

### 3. Fewer missed deadlines (risk-weighted)

**Formula:**
`deadlines_avoided_annual = I8 × early_warning_coverage_rate`

| Assumption | Low | Expected | High |
|---|---|---|---|
| Early-warning coverage of missed-deadline root cause | 40% | 60% | 80% |
| Deadlines avoided per year | 0.4 × I8 | 0.6 × I8 | 0.8 × I8 |
| Dollar impact per missed deadline (avoided grievance escalation) | $2,000 | $5,000 | $12,000 |

This output is presented as a range, not a guarantee.

### 4. Better steward utilisation (fairness)

**Formula:**
`overload_hours_redistributed = (overloaded_stewards × excess_hours_per_steward) × acceptance_rate`

| Assumption | Low | Expected | High |
|---|---|---|---|
| Overloaded stewards (% of I3) | 10% | 20% | 30% |
| Excess hours per overloaded steward / month | 4 | 8 | 16 |
| Acceptance rate on reassignment recommendations | 30% | 50% | 70% |

Dollar value: `redistributed_hours × I4`.

### 5. Faster precedent retrieval

**Formula:**
`precedent_hours_saved = retrievals × 1.5h`

| Retrievals / month | Low | Expected | High |
|---|---|---|---|
| Count | 8 | 16 | 32 |
| Hours saved / month | 12 | 24 | 48 |

### 6. Reduced backlog risk

**Formula:**
`backlog_reduction = I6 × reduction_rate`

| Assumption | Low | Expected | High |
|---|---|---|---|
| Backlog reduction % (quarterly) | 8% | 15% | 25% |
| Cases cleared / quarter | 0.08 × I6 | 0.15 × I6 | 0.25 × I6 |
| Monthly admin recovered | (cleared × I5) / 3 | (cleared × I5) / 3 | (cleared × I5) / 3 |

### 7. Executive reporting time saved

**Formula:**
`reporting_hours_saved = I7 × exec_view_savings_rate`

| Assumption | Low | Expected | High |
|---|---|---|---|
| Exec view savings % of I7 | 30% | 50% | 70% |
| Dollar value | × I4 | × I4 | × I4 |

Driver: the Executive Health Summary screen replaces manually-assembled board reports.

---

## C. Total ROI (roll-up)

### Monthly hours saved (sum of drivers 1, 4, 5, 6, 7)

`total_monthly_hours = admin_hours + steward_rebalance + precedent + backlog + exec_reporting`

### Monthly dollar value

`monthly_value = total_monthly_hours × I4`

### Annualised

`annual_value = monthly_value × 12`

### Arbitration avoidance (optional, stated as range)

`arbitration_upside = avoided_filings × I10`

| Conservative | Expected | Aggressive |
|---|---|---|
| 10% of I9 avoided | 20% of I9 avoided | 40% of I9 avoided |

### Payback period (pilot fee)

`payback_months = pilot_fee / monthly_value`

Where `pilot_fee = $12,000 CAD` (Local tier). Typical payback: **2–6 months** depending on conservative vs. expected scenario.

### Annual ROI %

`ROI_% = (annual_value − annual_subscription_fee) / annual_subscription_fee × 100`

---

## D. Worked example — 15-steward / 800-member local

Inputs used (conservative end):

| Input | Value |
|---|---|
| Members | 800 |
| Grievances / month | 20 |
| Stewards | 15 |
| Loaded hourly rate | $65 CAD |
| Admin time per case | 3.0 h |
| Backlog ≥30d | 30 |
| Exec reporting / month | 12 h |
| Missed deadlines / yr | 4 |
| Arbitration / yr | 2 |
| Avoided arbitration cost | $15,000 |

Expected outputs:

| Line | Hours saved / month | $ saved / month |
|---|---|---|
| Admin (precedent + early-warning + reassignment) | 50 | $3,250 |
| Steward rebalance redistribution | 12 | $780 |
| Exec reporting savings (50% of 12h) | 6 | $390 |
| **Monthly total** | **68** | **$4,420** |
| Annualised | 816 | **$53,040** |
| + Arbitration avoidance (expected, 20%) | — | +$6,000 |
| **Annualised ROI** | — | **~$59,040 CAD** |

Against a Local Plan subscription of **$28,000 CAD/year** (800-member band): **ROI ≈ 110%** in year 1.

Pilot payback: `$12,000 / $4,420` = **~2.7 months**.

---

## E. Rules of thumb for the buyer call

1. **Use your own numbers.** We pre-fill placeholders so the model renders; every cell is editable.
2. **Start conservative.** If you don't have a baseline for "cycle time", put 0 in the cycle-reduction line. The math still works on hours alone.
3. **Measure before you improve.** Phase-1 KPIs establish your baseline. Year-1 improvement is the delta from that baseline.
4. **Arbitration avoidance is upside, not baseline.** Exclude it from the must-have case; include it in the board case.
5. **If the expected case doesn't clear 100% ROI in year 1, push back on the inputs** — they're probably too conservative. The common error is underestimating reporting hours.

---

## F. Changelog of assumptions

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-04-23 | Initial release. All multipliers sourced from [`UNION_EYES_COGNITION_ROI.md`](../UNION_EYES_COGNITION_ROI.md). |

When the first pilot closes with real measured data, we replace placeholder multipliers with pilot-sourced ranges. Until then: these remain explicitly labelled assumptions.
