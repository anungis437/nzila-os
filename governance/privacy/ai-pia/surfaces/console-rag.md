# AI PIA — Console RAG (Retrieval-Augmented Generation)

**PIA ID:** PIA-2026-002
**Version:** 0.1
**Status:** DRAFT
**Created:** 2026-04-28
**Surface Owner:** Console Lead
**Privacy Lead:** _TBD_
**Security Lead:** _TBD_

---

## 1. Surface Summary

- **What it does:** Answers operator questions over indexed Nzila content (docs, governance, runbooks) via Azure OpenAI `gpt-4.1-mini` + `text-embedding-3-small`.
- **Where it lives:** `apps/console/ai/rag/*`, vectors in Postgres pgvector.
- **Users / data subjects:** Internal operators only (authenticated via `@nzila/platform-auth`).
- **Lawful basis:** Legitimate interest (employee productivity).
- **Automated decision-making?** No — informational answers only; operator acts on suggestions.

## 2. Data Flow

| Stage | Data category | PII? | PHI? | Storage | Region | Retention |
|-------|--------------|------|------|---------|--------|-----------|
| Indexed corpus | Internal docs (some contain PII) | Yes | No | Postgres pgvector | Canada Central | Until deletion |
| Query | Operator question | Yes (operator id) | No | Logs | Canada Central | 30 days |
| Model call | Prompt + retrieved chunks | Yes | No | In-flight | East US | zero-retention |
| Output | Generated answer | derived | No | Logs | Canada Central | 30 days |

- **Model provider / version:** Azure OpenAI `gpt-4.1-mini` (East US), embeddings `text-embedding-3-small` (East US).
- **Inference region:** East US.
- **Training-data implications:** Azure OpenAI zero-retention contract.
- **Sub-processors:** Microsoft Azure.

## 3. Info-Tech 12-Domain Snapshot (highlights)

| # | Domain | Maturity | Notes |
|---|--------|---------|-------|
| 1 | Governance | 3 | Reasoning context envelope contract enforced. |
| 6 | Notices and Consent | 4 | Operators consent via employment + AUP. |
| 8 | Privacy by Design | 4 | Tenant scoping in retrieval; cross-org leakage blocked at retrieval layer. |
| 9 | Information Security | 4 | Auth-gated; org-scoped. |

## 5. Risk Register

| ID | Risk | L | I | Inherent | Mitigation | Residual |
|----|------|---|---|----------|------------|----------|
| R1 | Cross-tenant retrieval leakage | L | H | MED | Mandatory `org_id` filter at vector query layer; contract test enforces | LOW |
| R2 | Hallucinated answer treated as authoritative | M | M | MED | UI shows source chunks + confidence; "verify before acting" warning | LOW |
| R3 | Cross-border (US) inference of operator data | L | L | LOW | Operator notice in AUP | LOW |

## 6. Algorithmic Traceability

- Reasoning context envelope MUST be emitted for every RAG call (retrieved chunk ids, model, temperature, prompt template version).
- Envelope persisted with the response for audit.

## 7. Data Subject Rights

| Right | Supported? | How |
|-------|-----------|-----|
| Access | Yes | Operators can view their own query history |
| Erasure | Yes | Query logs purged at 30 days; on request earlier |

## 8. Approvals

_Pending._
