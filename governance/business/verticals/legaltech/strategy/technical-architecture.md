# Court Lens — Technical Architecture

> Architecture overview for Court Lens AI legal analytics platform. Django backend, Azure OpenAI for NLP, pgVector for semantic search across 500K+ CanLII decisions.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐   │
│  │ Web App  │  │ REST API │  │ White-Label Portal   │   │
│  │ (React)  │  │ (DRF)    │  │ (Client-Facing)      │   │
│  └──────────┘  └──────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────────┐
│                  Application Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Prediction   │  │ Search &     │  │ Analytics &  │  │
│  │ Engine       │  │ Discovery    │  │ Reporting    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Judge Profile│  │ NLP Pipeline │  │ Citation     │  │
│  │ Service      │  │ (Azure OAI)  │  │ Graph Engine │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────────┐
│                    Data Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ PostgreSQL   │  │ pgVector     │  │ Redis Cache  │  │
│  │ (682 entities)│  │ (Embeddings) │  │ (Query Cache)│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │ Azure Blob   │  │ CanLII Data  │                     │
│  │ (Documents)  │  │ Pipeline     │                     │
│  └──────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

---

## Database Schema (682 Entities)

### Core Domains

| Domain | Entity Count | Key Tables |
|--------|-------------|------------|
| Cases | ~180 | `case`, `case_text`, `case_metadata`, `case_outcome`, `case_citation` |
| Judges | ~80 | `judge`, `judge_appointment`, `judge_tendency`, `judge_practice_area_stats` |
| Courts | ~40 | `court`, `court_level`, `jurisdiction`, `court_schedule` |
| Legal Entities | ~100 | `party`, `lawyer`, `law_firm`, `expert_witness` |
| Predictions | ~60 | `prediction_request`, `prediction_result`, `confidence_score`, `comparable_case` |
| Analytics | ~70 | `query_log`, `user_search`, `report_template`, `dashboard_widget` |
| Users & Auth | ~50 | `user`, `subscription`, `firm`, `team`, `api_key` |
| NLP & Embeddings | ~50 | `embedding`, `entity_extraction`, `case_summary`, `legal_concept` |
| Citations | ~30 | `citation`, `citation_network`, `statute_reference`, `regulation_ref` |
| System | ~22 | `audit_log`, `data_pipeline_run`, `model_version`, `feature_flag` |

### Key Relationships
- `case` → many `case_citation` → many `case` (citation graph)
- `case` → one `judge` → many `judge_tendency` (aggregated stats)
- `prediction_request` → many `comparable_case` → references `case`
- `case` → one `embedding` (pgVector, 1536-dimensional)

---

## AI/ML Pipeline

### Prediction Flow
```
User Query → Practice Area Classification → Judge Identification
    → Comparable Case Retrieval (pgVector similarity)
    → Feature Extraction (judge tendencies, case complexity, jurisdiction)
    → Prediction Model (XGBoost ensemble + GPT-4 reasoning)
    → Outcome Probability + Confidence Score + Comparable Cases
    → Response (< 3 seconds target latency)
```

### Model Architecture
- **Case Embeddings**: Azure OpenAI `text-embedding-ada-002` → 1536-dim vectors stored in pgVector
- **Outcome Prediction**: XGBoost ensemble trained on labeled case outcomes
- **Settlement Estimation**: Gradient boosted regression on damage awards + case features
- **Judge Tendency**: Bayesian aggregation of per-judge outcome rates by practice area
- **Case Summarization**: GPT-4 with legal prompt engineering → 200-word structured summaries

### Training Pipeline
- **Frequency**: Quarterly retraining on new CanLII decisions
- **Data Split**: 80/10/10 train/validation/test by decision date (temporal split)
- **Evaluation**: Accuracy, Brier score (calibration), F1 by practice area
- **Monitoring**: Prediction accuracy drift detection, alerting on degradation
- **Current Accuracy**: 72% (target 85% by 2027)

---

## NLP & Text Processing

### Entity Extraction Pipeline
```
Raw CanLII Decision Text
    → HTML stripping + legal text normalization
    → Named Entity Recognition (judges, parties, counsel, statutes)
    → Outcome classification (plaintiff/defendant win, settlement, dismissed)
    → Practice area tagging (litigation, family, criminal, immigration)
    → Damage/award amount extraction (regex + NER)
    → Citation parsing (neutral citations, CanLII format)
    → Embedding generation (text-embedding-ada-002)
    → Storage (PostgreSQL + pgVector)
```

### Bilingual Processing
- English NLP: primary pipeline, 85% of CanLII corpus
- French NLP: Azure OpenAI with Quebec legal terminology fine-tuning
- Language detection: automatic routing to appropriate pipeline
- Cross-language search: query in either language, retrieve relevant cases in both

---

## Data Pipeline (CanLII Ingestion)

### Daily Pipeline
1. **Scrape**: CanLII API / structured scraping for new decisions (50-200/day)
2. **Parse**: Extract metadata, parties, judge, outcome, citations
3. **Clean**: Normalize text, resolve entity references, deduplicate
4. **Embed**: Generate pgVector embeddings for new cases
5. **Index**: Update search indices, citation graph, judge profiles
6. **Validate**: Automated quality checks (entity coverage, embedding quality)

### Corpus Statistics
- Total decisions: 500,000+ (growing ~15,000/year)
- Courts covered: Federal, all 13 provinces/territories
- Date range: 1990s–present (coverage varies by court)
- Average decision length: 5,000 words
- Storage: ~50GB text + 12GB embeddings

---

## Search Architecture

### Hybrid Search (Keyword + Semantic)
```
User Query: "slip and fall municipal liability ice removal"
    → Keyword search (PostgreSQL full-text, BM25 ranking)
    → Semantic search (pgVector cosine similarity, top 50)
    → Result fusion (Reciprocal Rank Fusion algorithm)
    → Relevance re-ranking (GPT-4 cross-encoder)
    → Final results with prediction overlays
```

### Performance Targets
- Query latency: < 2 seconds (p95)
- Prediction latency: < 3 seconds (p95)
- Embedding search: < 500ms for 500K vectors
- Concurrent users: 500+ simultaneous queries

---

## Infrastructure (Azure)

### Compute
- **Web/API**: Azure App Service (B2 → P2v3 scaling plan)
- **ML Training**: Azure ML Compute (GPU NC6s_v3 for quarterly retraining)
- **Background Jobs**: Azure Functions (CanLII ingestion, embedding generation)

### Storage
- **PostgreSQL**: Azure Database for PostgreSQL Flexible Server (GP_Gen5_4)
- **pgVector**: Extension on same PostgreSQL instance (HNSW index)
- **Blob Storage**: Raw CanLII documents, PDF exports, model artifacts
- **Redis**: Azure Cache for Redis (query result caching, session management)

### Networking
- **CDN**: Azure Front Door for static assets and API caching
- **WAF**: Web Application Firewall (OWASP rule sets)
- **Private Endpoints**: Database and cache accessible only via VNet

### Monitoring
- **Application Insights**: Request tracing, dependency tracking, error logging
- **Azure Monitor**: Infrastructure metrics, alerting on latency/error spikes
- **Custom Dashboards**: Prediction accuracy trends, query volume, user engagement

---

## Security Architecture

### Data Protection
- Encryption at rest: AES-256 (Azure managed keys)
- Encryption in transit: TLS 1.3 (all connections)
- Database: row-level security per firm, column-level encryption for PII
- API: OAuth 2.0 + JWT tokens, rate limiting per subscription tier

### Access Control
- RBAC: Firm Admin, Lawyer, Associate, Read-Only roles
- Multi-tenancy: firm-level data isolation in shared database (RLS policies)
- API keys: scoped per endpoint, rotatable, usage-tracked
- Audit logging: all data access, prediction requests, admin actions

### Compliance Path
- **SOC 2 Type II**: target 2026 (trust services criteria)
- **PIPEDA**: ongoing compliance for personal information in decisions
- **Law Society**: solicitor-client privilege — no client data in prediction models
