# Governance Review Cadence

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-field-operations-index.md](./master-field-operations-index.md)

This document operationalizes governance review rhythm across
Nzila.

---

## 1. Review categories

| Review                 | Cadence       | Reviewer                |
| ---------------------- | ------------- | ----------------------- |
| Rollout review         | Per-promotion | Rollout operator        |
| Continuity review      | Weekly        | Continuity reviewer     |
| Stabilization review   | Per window    | Continuity reviewer     |
| Legitimacy review      | Bi-weekly     | Platform reviewer       |
| Attestation review     | Weekly        | Governance operator     |
| Onboarding review      | Phase-paced   | Onboarding operator     |
| Environment review     | Per event     | Environment reviewer    |

---

## 2. Review queue

The governance review queue is rendered in Control Plane → Governance
→ Field Operations. It surfaces:

- reviews due (cadence-based)
- reviews open (initiated, not closed)
- reviews recently completed (last 14 days)

The queue is interpretive — it does not assign work or impose SLA
penalties.

---

## 3. Review completion

A review is closed when:

- a recorded attestation exists for the review
  (`reviews-YYYY-MM.jsonl`), or
- a recorded interpretive note exists in the same ledger.

Absence of activity during a calm period is a legitimate review
outcome.

---

## 4. Cadence summary

The cadence summary is the calm rollup published to the Console
executive briefing surface. It reports:

- reviews completed
- reviews open
- reviews skipped with interpretation
- continuity events

The summary fits on a single screen and contains no charts.

---

## 5. Operational review calendar

The review calendar is implicit in the cadence model — reviews are
due when the cadence rhythm says so. The system surfaces them; it
does not schedule them.

---

## 6. Stabilization review panels

When a tier is stabilizing, the Stabilization Review panel surfaces:

- the open continuity window
- the most recent promotion that triggered it
- the recommended interpretive posture

The panel does not encourage shortening the window.

---

## 7. Posture

Governance review remains **interpretive**. It does not become
bureaucratic. It does not gamify completion. It does not measure
operator performance by review volume.
