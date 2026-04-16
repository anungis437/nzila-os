# Data Residency & Sovereignty Policy

## Purpose

This document defines the data residency requirements, sovereignty controls, and enforcement mechanisms for all data processed, stored, or transmitted by the Nzila OS platform.

---

## Residency Declarations

### Current Deployments

| Environment | Region | Provider | Primary DB | Storage | Notes |
|---|---|---|---|---|---|
| Staging | Canada Central | Azure | PostgreSQL Flexible (Canada Central) | Azure Blob (Canada) | All data stays in Canada |
| Production (target) | Canada Central | Azure | PostgreSQL Flexible (Canada Central) | Azure Blob (Canada) | |

### Regulated Data Categories

| Category | Regulation | Residency Requirement | Enforcement |
|---|---|---|---|
| Personal information (PII) | PIPEDA (Canada), Law 25 (Québec) | Must reside in Canada | DB RLS + org-scoping + region-locked storage |
| Union member data | Provincial labour law | Canada only; no cross-border transfer | `union-eyes` org isolation; no CDN for PII fields |
| Financial records | FINTRAC, provincial securities law | Canada; 7-year retention | Encrypted at rest; immutable audit log |
| AI training data | PIPEDA s.5(3), EU AI Act (when applicable) | Processed in declared region | Azure OpenAI East US — see exception below |
| Authentication tokens | PIPEDA | Transient; no persistent PII storage | PG sessions in Canada Central |

### Azure OpenAI Exception

Azure OpenAI inference calls (`nzila-openai-eastus`, `nzila-openai-eastus2`) send prompts to US data centres.

**Controls in place:**

- Prompts must NOT include raw PII fields — callers must anonymise or pseudonymise before inference
- Prompt templates are reviewed in `packages/ai-core/` for PII leakage
- Azure OpenAI Data Processing Addendum accepted; no data used for model training (Microsoft commitment)
- Whisper (voice transcription) is East US 2 only — audio files must be stripped of identifying metadata before upload

### Azure OpenAI Risk Mitigation Strategy

| Risk | Mitigation | Enforcement |
|---|---|---|
| Prompt contains direct identifiers | Pre-inference redaction middleware + deny-list checks | CI contract tests + runtime request validator |
| Cross-border transfer over-collection | Data minimization templates by use case | Prompt schema review before deployment |
| Inference misuse for regulated decisions | Human-in-the-loop for high-impact outputs | Product policy gate + audit trail |
| Region outage for East US/East US 2 | Documented fallback mode (degraded local-only workflows) | Incident drill twice per year |

---

## Org-Level Data Isolation

All user-facing data is isolated by `org_id` at the database layer:

- Row-Level Security (RLS) enabled on all multi-tenant tables
- `org_id` index present on every tenant-scoped table
- `auth()` resolution enforces org boundary; `getOrganizationIdForUser()` used for all role lookups
- Cross-org queries require explicit Platform Admin or Super Admin role — audited in `evidence_exports`

## Data Classification Framework

| Class | Examples | Storage and transfer policy |
|---|---|---|
| Public | Marketing content, docs | Any approved region; integrity controls required |
| Internal | Operational telemetry, non-PII logs | Canada preferred; approved exception needed for non-Canada |
| Confidential | Member records, case notes, payroll data | Canada-only storage; encrypted in transit and at rest |
| Restricted | Identity docs, sensitive legal records | Canada-only, least-privilege access, explicit access review |

Every new field in app schemas must declare a classification label before production rollout.

---

## Data-at-Rest Encryption

| Store | Encryption | Key Management |
|---|---|---|
| PostgreSQL (Azure) | AES-256 (Azure-managed) | Azure Key Vault |
| Azure Blob Storage | AES-256 (Azure-managed) | Azure Key Vault |
| Secrets | Azure Key Vault (software-protected) | Managed identity access |
| Session tokens | Argon2id hash; token itself is opaque random | No key needed (hash one-way) |

---

## Data-in-Transit Encryption

- All HTTP traffic: TLS 1.2 minimum; TLS 1.3 preferred
- Database connections: `sslmode=require` enforced
- Inter-service calls within Container Apps environment: mutual TLS via Container Apps managed certificates
- Storage SDK: HTTPS-only (enforced at Azure storage account level)

---

## Cross-Border Transfer Controls

### Prohibited

- Replication of PII to EU, US, or any non-Canada region without documented legal basis and DPA
- Use of third-party analytics SDKs that exfiltrate user event data to foreign servers
- AI fine-tuning on production data without explicit consent collection and residency review

### Permitted with Controls

- Azure OpenAI inference (see exception above)
- GitHub Actions CI runners (US) — no production data; test fixtures only
- Sentry / error monitoring — PII scrubbing required before event submission

---

## Breach Notification Obligations

| Regulation | Notification threshold | Timeline | Authority |
|---|---|---|---|
| PIPEDA | Real risk of significant harm | 72 hours to OPC; affected individuals ASAP | Office of the Privacy Commissioner of Canada |
| Law 25 (Québec) | Confidentiality incident affecting Québec residents | 72 hours to CAI | Commission d'accès à l'information |
| GDPR (if applicable) | Data breach | 72 hours to DPA | Applicable EU supervisory authority |

Breach response procedure: `SECURITY.md` → "Incident Response" section.

---

## Enforcement and Review

| Activity | Frequency | Owner |
|---|---|---|
| Residency compliance review | Quarterly | Platform Engineering + Legal |
| New data category assessment | Before feature launch | Feature team + Privacy lead |
| AI prompt PII audit | Each AI SDK version bump | `packages/ai-core` owner |
| Storage account region audit | Semi-annual | DevOps / Infrastructure |
| DB connection string region check | CI (governance gate) | Automated |

## Automated Compliance Checks

Runtime and CI controls for residency compliance:

1. CI verifies policy presence and required sections via governance gate.
2. Contract tests validate org scoping and tenant isolation boundaries.
3. Deployment checks ensure region-locked infrastructure declarations.
4. Quarterly automated scan compares provisioned resource regions against approved residency matrix.

Any detected non-Canada data store for Confidential or Restricted classes is a fail-closed release blocker.

---

## Governance Gate Integration

GOV-GATE-016 checks that this policy file exists and contains the required sections. Run:

```bash
pnpm validate:governance:gate
```
