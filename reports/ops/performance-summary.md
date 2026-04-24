# Union Eyes — Monthly Route Performance Summary

> **Report period:** {{PERIOD}}  
> **Generated:** {{GENERATED_AT}}  
> **Source:** Azure Application Insights + OpenTelemetry  
> **Classification:** Internal — SRE / Platform Engineering

---

## 1. Availability

| Metric | Target | Status |
|--------|--------|--------|
| Uptime | 99.9% | {{UPTIME_STATUS}} |
| Total requests | — | {{TOTAL_REQUESTS}} |
| Total errors | — | {{TOTAL_ERRORS}} |
| Global error rate | < 1% | {{GLOBAL_ERROR_RATE}} |

---

## 2. Priority Route Performance

| Route | P50 (ms) | P95 (ms) | Error Rate | Volume | Status |
|-------|---------|---------|-----------|--------|--------|
| `GET /dashboard/leadership` | — | — | — | — | ⏳ Pending live instrumentation |
| `GET /dashboard/work` | — | — | — | — | ⏳ Pending live instrumentation |
| `GET /grievances/new` | — | — | — | — | ⏳ Pending live instrumentation |
| `POST /api/cases` | — | — | — | — | ⏳ Pending live instrumentation |
| `POST /api/workflow/transition` | — | — | — | — | ⏳ Pending live instrumentation |
| `POST /api/pilot/onboarding` | — | — | — | — | ⏳ Pending live instrumentation |

> **Note:** Numeric values are populated from Azure Application Insights
> when this report is run against live instrumentation. The monitoring
> workbook at `docs/ops/azure-monitor/union-eyes-route-performance.workbook.json`
> queries these routes directly.

---

## 3. Route Regressions (> 200ms p95 delta, 7d vs 24h)

| Route | P95 Last 7d | P95 Last 24h | Delta | Risk |
|-------|------------|-------------|-------|------|
| None detected | — | — | — | — |

---

## 4. Route Risk Watchlist

Routes with p95 > 2000ms or error rate > 5% during this period:

| Route | Issue | Owner | Action |
|-------|-------|-------|--------|
| None this period | — | — | — |

---

## 5. Observability Status

| Tool | Status |
|------|--------|
| Sentry error tracking | ✅ Integrated |
| OpenTelemetry traces | ✅ Wired |
| Azure Application Insights | ✅ Active |
| Per-route dashboard (workbook) | ✅ `docs/ops/azure-monitor/union-eyes-route-performance.workbook.json` |
| Azure Monitor alerts | Configured via `apps/union-eyes/infra/main.bicep` |

---

## 6. Performance Targets

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| P95 latency | ≤ 500ms | 500ms–2s | > 2s |
| Error rate | < 1% | 1%–5% | > 5% |
| Uptime | > 99.9% | 99.5%–99.9% | < 99.5% |

---

## 7. Corrective Actions This Period

| Action | Owner | Status |
|--------|-------|--------|
| Per-route latency dashboard deployed | Platform Engineering | ✅ Workbook published |
| Numeric performance data from live instrumentation | SRE | ⏳ 2026-Q2 |

---

_Generated from `reports/ops/performance-summary.md` template · {{GENERATED_AT}}_
