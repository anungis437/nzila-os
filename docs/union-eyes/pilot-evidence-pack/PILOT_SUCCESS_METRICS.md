# Pilot Success Metrics — Union Eyes CUPE Controlled Pilot

**Status:** CURRENT  
**Last updated:** 2026-05-14  
**Source of truth:** This document + `PILOT_SCOPE_LOCK.md`  
**Supersedes:** N/A (new)  
**Measurement window:** 90 days from pilot launch date

---

## Overview

These metrics define what success looks like for the Union Eyes controlled pilot.
They are scoped to the pilot parameters: **1 org, 5 worksites, ≤ 200 members, 90-day window**.

No metric is tied to revenue or commercial expansion — this pilot proves operational
viability and real-world defensibility before scale.

---

## 1. Adoption Metrics

| Metric | Target | Warning | Failure |
|--------|--------|---------|---------|
| Active stewards (used app in last 7 days) | ≥ 3 by week 4 | 2 by week 4 | < 2 by week 6 |
| Org admin monthly active | 100% (Diane active) | — | Not active by week 3 |
| IT/privacy director activity | ≥ 1 audit log review by week 8 | — | No activity by week 10 |
| New cases created via app (vs. paper/email) | ≥ 50% of new cases by week 8 | < 30% by week 8 | < 10% by end of pilot |

---

## 2. Case / Intake Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Cases created | ≥ 20 end-to-end by close | Intake → resolution or formal deferral |
| Case intake completion rate | ≥ 90% (started → submitted) | Partial intakes indicate UX friction |
| Evidence attachments per case | ≥ 1 (where relevant) | Validates file upload / DMS flow |
| Cases with FSM state transitions ≥ 2 | ≥ 10 cases | Validates workflow engine in production |
| Cases deferred correctly (DEFERRED state) | Tracked (no minimum) | Validates scope discipline |

---

## 3. Workflow Completion Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Cases reaching RESOLVED or CLOSED | ≥ 5 cases within 90 days | Real arbitration cycles may exceed pilot window |
| SLA overdue alerts triggered | Tracked (no minimum) | Validates SLA detection is working |
| Invalid action attempts (blocked by FSM) | Tracked | Validates FSM enforcement |
| Evidence packages exported | ≥ 1 successful sealed export | Critical — must prove before close |

---

## 4. Support Burden Metrics

| Metric | Target | Alert threshold |
|--------|--------|----------------|
| Support tickets / week (Tier 2) | ≤ 3/week average | > 6/week for 2 consecutive weeks |
| SEV-1 incidents | 0 | Any SEV-1 triggers review |
| SEV-2 incidents | ≤ 2 total | > 2 triggers SRE review |
| Data correction requests | ≤ 5 total | > 5 triggers onboarding review |
| Unresolved issues at pilot close | 0 open SEV-1, ≤ 2 open SEV-2 | — |

---

## 5. Security / Compliance Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Cross-org access violations (actual) | 0 | Any incident is SEV-1 |
| Unauthorized data access reports | 0 | — |
| Audit log completeness | 100% of case actions logged | Verified by Privacy Director review |
| DPA compliance events | 0 violations | Privacy Director confirms monthly |
| Failed auth attempts (unusual spike) | Monitored | Alert on > 10x baseline |

---

## 6. Performance / Reliability Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Case creation p95 latency | < 2s | Measured at API layer |
| Evidence export p95 latency | < 10s (single case) | End-to-end from request to sealed package |
| App availability | ≥ 99.5% (business hours) | Downtime calculated Mon–Fri 8am–8pm ET |
| Health endpoint passing | 100% of spot checks | Captured in live evidence runbook |
| Failed evidence exports (unrecoverable) | 0 | Any failure is escalated |

---

## 7. Buyer Value Metrics

These are qualitative signals that inform the commercial relationship.

| Signal | Collection method | Timing |
|--------|------------------|--------|
| Steward NPS (would you use this instead of paper?) | 5-question survey | Week 8 |
| Case defensibility rating (would this hold in arbitration?) | Interview with ED | Week 10 |
| Privacy Director confidence (audit trail adequate?) | Interview | Week 10 |
| "Would expand to full org" intent | Structured conversation | Week 12 |
| Top 3 friction points | Ongoing via support + survey | Continuous |

---

## 8. Qualitative Feedback Goals

By end of pilot, we need documented evidence of:

1. **At least one steward statement** confirming the case workflow improved their work
2. **Privacy Director review** of the audit log confirming it is complete and legible
3. **ED review** of the leadership dashboard confirming value for oversight
4. **One sealed evidence package** verified by the pilot org as suitable for grievance purposes

These are documented in the pilot close report (not part of this metrics doc).

---

## 9. Expansion Threshold Criteria

The following must ALL be true before recommending expansion beyond the pilot:

| # | Criterion |
|---|-----------|
| 1 | ≥ 20 cases processed with ≥ 5 reaching RESOLVED/CLOSED |
| 2 | ≥ 1 sealed evidence package exported and verified by pilot org |
| 3 | 0 SEV-1 incidents without root-cause resolution |
| 4 | Pilot org ED confirms operational viability |
| 5 | Live Azure evidence complete (all runbook sections verified) |
| 6 | Support burden at or below target thresholds |
| 7 | Privacy Director confirms audit log adequacy |
| 8 | Security lead reviews and signs off on live evidence manifest |

If any criterion is unmet at pilot close, the expansion gate is CONDITIONAL (not denied)
with a documented plan to close the gap.

---

## Measurement and Reporting

- **Weekly:** Support ticket count, case count, active users — reported in weekly sync
- **Monthly:** Full metrics review against all tables above — reported to exec
- **End-of-pilot:** Final metrics report with expansion recommendation — delivered to pilot org leadership and Nzila founders

Metrics are captured from:
- Union Eyes application database (case/event tables)
- Azure Monitor logs (latency, availability)
- Support channel ticket counts
- Pilot user surveys (manual)

---

*Metrics questions: contact Nzila Product at product@nzila.ca*
