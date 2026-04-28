# AI PIA — Zonga Voice (Azure OpenAI Whisper)

**PIA ID:** PIA-2026-001
**Version:** 0.1
**Status:** DRAFT
**Created:** 2026-04-28
**Surface Owner:** Zonga Lead
**Privacy Lead:** _TBD_
**Security Lead:** _TBD_

---

## 1. Surface Summary

- **What it does:** Accepts audio uploads from Zonga end-users and transcribes them via Azure OpenAI Whisper for downstream record-keeping / search.
- **Where it lives:** `apps/zonga/app/api/voice-upload/*` → `AZURE_OPENAI_WHISPER_ENDPOINT` (eastus2).
- **Users / data subjects:** Zonga registered users (members and partners).
- **Lawful basis:** Performance of contract (service delivery). For sensitive content, explicit consent at upload time.
- **Automated decision-making (GDPR Art. 22)?** No — transcript is informational; no automated adverse decision.

## 2. Data Flow

| Stage | Data category | PII? | PHI? | Storage | Region | Retention |
|-------|--------------|------|------|---------|--------|-----------|
| Input audio | Voice (biometric-adjacent), spoken content | Yes | Possible | Azure Blob (uploads container) | Canada Central | 30 days then purge |
| Whisper call | Audio bytes | Yes | Possible | In-flight only | East US 2 | none (zero-retention contract) |
| Output transcript | Text | Yes | Possible | Postgres `voice_transcripts` | Canada Central | 1 year |
| Logs / traces | Request id, duration, size | No | No | Log Analytics | Canada Central | 30 days |

- **Model provider / version:** Azure OpenAI `whisper` v001 (`nzila-openai-eastus2`)
- **Inference region:** East US 2 (cross-border from Canada Central data plane)
- **Training-data implications:** Azure OpenAI zero-retention contract applies.
- **Sub-processors:** Microsoft Azure.

## 3. Info-Tech 12-Domain Snapshot (highlights)

| # | Domain | Maturity | Notes |
|---|--------|---------|-------|
| 2 | Regulatory Compliance | 3 | PIPEDA in scope. Cross-border (US) requires user notice. |
| 3 | Data Process & Handling | 3 | Server-side encryption; keyed by Azure-managed keys. |
| 6 | Notices and Consent | 2 | **GAP:** explicit consent dialog for voice upload not documented. |
| 8 | Privacy by Design | 3 | Defaults: audio purged after 30 days; transcript editable/deletable by user. |
| 10 | Third-Party Management | 4 | Microsoft DPA covers Azure OpenAI. |

## 5. Risk Register

| ID | Risk | L | I | Inherent | Mitigation | Residual |
|----|------|---|---|----------|------------|----------|
| R1 | Cross-border transfer to US (East US 2) without explicit notice | M | M | MED | Add consent + notice at upload; document in privacy policy | LOW |
| R2 | Voice may capture incidental third-party speech | M | M | MED | UI warning before record/upload | LOW |
| R3 | PHI may appear in transcript (member health complaint) | L | H | MED | Treat `voice_transcripts` as PHI-class storage; restrict access | LOW |

## 6. Algorithmic Traceability

- Whisper output is a faithful transcription, not a decision; reasoning envelope N/A.
- Request id correlation between upload, Whisper call, and transcript row required.

## 7. Data Subject Rights

| Right | Supported? | How |
|-------|-----------|-----|
| Access | Partial | User can view transcripts; access endpoint TBD |
| Erasure | Partial | Manual via support; needs self-serve endpoint |

## 8. Approvals

_Pending._
