# CBA Intelligence — Operator Runbook

## Overview

The CBA Intelligence subsystem ingests collective bargaining agreements (CBAs) from Canadian federal and provincial sources, extracts structured data (clauses, wages, metadata), and provides benchmarking and search capabilities.

---

## Architecture

```
Sources (17 configured)
  ↓  adapters (7 registered)
Ingestion Orchestrator
  ↓  raw documents
Extraction Orchestrator (rule-based NLP)
  ↓  findings, clauses, wages
Agreements + Benchmarks
  ↓
API / CSV Export
```

### Key Components

| Component | Path | Purpose |
|---|---|---|
| Source Registry | `lib/services/cba-intelligence/source-registry-service.ts` | CRUD for data sources |
| Ingestion Orchestrator | `lib/services/cba-intelligence/ingestion-orchestrator.ts` | Discover → fetch → persist pipeline |
| Extraction Orchestrator | `lib/services/cba-intelligence/extraction-orchestrator.ts` | NLP clause/wage extraction |
| Ingestion Scheduler | `lib/services/cba-intelligence/ingestion-scheduler.ts` | Cron scheduling + backoff |
| Adapters | `lib/services/cba-intelligence/adapters/` | Source-specific fetch logic |
| Seed Sources | `lib/services/cba-intelligence/seed-sources.ts` | 17 pre-configured Canadian sources |

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/cba-intelligence/ingestion/seed` | Seed 17 sources into registry |
| POST | `/api/cba-intelligence/ingestion/run` | Trigger ingestion (all or single source) |
| POST | `/api/cba-intelligence/extraction/run` | Trigger extraction (all raw docs or single) |
| GET | `/api/cba-intelligence/agreements` | List agreements (filtered, paginated) |
| GET | `/api/cba-intelligence/agreements/export` | CSV export with jurisdiction/sector filters |

All endpoints require `commercial_reporting` entitlement and member-level auth.

---

## Operational Procedures

### Initial Setup

```bash
# 1. Seed sources (one-time)
curl -X POST https://<host>/api/cba-intelligence/ingestion/seed \
  -H "Authorization: Bearer $TOKEN"

# 2. Run initial ingestion
curl -X POST https://<host>/api/cba-intelligence/ingestion/run \
  -H "Authorization: Bearer $TOKEN"

# 3. Run extraction on ingested documents
curl -X POST https://<host>/api/cba-intelligence/extraction/run \
  -H "Authorization: Bearer $TOKEN"
```

### Scheduled Ingestion

The scheduler runs ingestion at a configurable interval (default: 24h) with exponential backoff for failing sources (max: 7 days). It can be triggered by:

- **Node.js setInterval** — `startScheduler()` in long-running processes
- **Vercel Cron** — via the `/api/cba-intelligence/ingestion/run` route
- **External cron** — GitHub Actions, Azure Functions Timer Trigger

### Re-run a Single Source

```bash
curl -X POST https://<host>/api/cba-intelligence/ingestion/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sourceId": "uuid-of-source"}'
```

### Export Data

```bash
# Full export
curl https://<host>/api/cba-intelligence/agreements/export \
  -H "Authorization: Bearer $TOKEN" -o agreements.csv

# Filtered by jurisdiction
curl "https://<host>/api/cba-intelligence/agreements/export?jurisdiction=CA-ON" \
  -H "Authorization: Bearer $TOKEN" -o ontario-agreements.csv
```

---

## Monitoring

### Prometheus Metrics

| Metric | Type | Labels | Description |
|---|---|---|---|
| `union_eyes_cba_intel_ingestion_jobs_total` | Counter | status, source_type | Total ingestion jobs by outcome |
| `union_eyes_cba_intel_ingestion_duration_seconds` | Histogram | source_type | Job duration distribution |
| `union_eyes_cba_intel_documents_ingested_total` | Counter | document_type, language | Documents ingested |
| `union_eyes_cba_intel_extraction_confidence` | Histogram | clause_family | Extraction confidence distribution |
| `union_eyes_cba_intel_review_queue_depth` | Gauge | target_type | Pending review items |
| `union_eyes_cba_intel_review_decisions_total` | Counter | decision, target_type | Review decisions |
| `union_eyes_cba_intel_source_freshness_status` | Gauge | source_slug | 1=fresh, 2=aging, 3=stale, 4=expired |
| `union_eyes_cba_intel_agreements_total` | Gauge | jurisdiction, review_status | Total agreements |

### Recommended Alerts

| Alert | Condition | Severity |
|---|---|---|
| Ingestion failure spike | `rate(cba_intel_ingestion_jobs_total{status="failed"}[1h]) > 3` | Warning |
| All sources stale | `min(cba_intel_source_freshness_status) >= 3` | Critical |
| Zero documents ingested (24h) | `increase(cba_intel_documents_ingested_total[24h]) == 0` | Warning |
| Low extraction confidence | `histogram_quantile(0.5, cba_intel_extraction_confidence) < 0.3` | Warning |

---

## Troubleshooting

### Ingestion job fails for a source

1. Check logs for the source ID: `sourceId=<uuid>`
2. Verify the source URL is accessible: `curl -I <baseUrl>`
3. Check adapter registration: `getRegisteredAdapterKeys()` includes the source's `adapterKey`
4. If rate-limited, the scheduler will back off exponentially (2^failures × 24h, max 7d)
5. Manual retry: POST to `/api/cba-intelligence/ingestion/run` with `{"sourceId": "..."}`

### Extraction produces zero findings

1. Verify document has `rawContent` (not null/empty)
2. Check `processingStatus` is `raw` or `normalized`
3. Review the document's content type — HTML stripping may have removed all text
4. Run extraction on a single document: POST to `/api/cba-intelligence/extraction/run` with `{"documentId": "..."}`

### Source marked as stale/expired

1. Check `cba_intel_source_freshness_status` gauge for the source slug
2. Review the source's last successful ingestion job in `cba_intel_ingestion_jobs`
3. If the external data source changed URLs, update `baseUrl` in the source registry
4. Re-enable with: update source `isActive = true`, then trigger manual ingestion

---

## Registered Adapters

| Key | Source Type | Description |
|---|---|---|
| `html_bulletin` | Generic | HTML page scraper (base adapter) |
| `esdc_federal` | ESDC | Employment and Social Development Canada |
| `canlii_legal` | CanLII | Canadian Legal Information Institute |
| `statscan_csv` | Statistics Canada | StatsCan open data CSV tables |
| `provincial_board` | Provincial LRBs | OLRB, BCLRB, ALRB, TAT, SLRB, MLRB |
| `union_bargaining` | Union Bulletins | CUPE, Unifor, USW, PSAC, UFCW |
| `fpslreb` | FPSLREB | Federal Public Sector Labour Relations Board |

---

## Database Tables

| Table | Purpose |
|---|---|
| `cba_intel_sources` | Source registry (17 seeded) |
| `cba_intel_documents` | Raw and processed documents |
| `cba_intel_ingestion_jobs` | Job tracking with status/stats |
| `cba_intel_extraction_runs` | Extraction run history |
| `cba_intel_findings` | Extracted data points |
| `cba_intel_agreements` | Normalized agreement records |
| `cba_intel_wage_adjustments` | Parsed wage increases |
| `cba_intel_clauses` | Classified clause text |
| `cba_intel_freshness_log` | Source freshness tracking |
| `cba_intel_benchmarks` | Comparison benchmarks |
| `cba_intel_review_queue` | Human review queue |
