# AI Risk Classification

**Doc ID:** AI-RISK-2026-001
**Version:** 1.0
**Owner:** AI Governance Committee
**Authority:** [ai-policy.md](ai-policy.md) §3

Every AI surface at Nzila is classified into one of four tiers, harmonized
with the EU AI Act's risk-based approach and extended for jurisdictions
where Nzila operates (Canada, US).

## 1. Tier definitions

### Tier 0 — Prohibited
Falls within an EU AI Act Article 5 prohibited practice OR otherwise barred
by [ai-policy.md](ai-policy.md) §5. **NEVER built or operated.**

### Tier 1 — High risk
Annex III–style use cases or otherwise capable of causing significant harm
to rights, safety, or material interests. Examples relevant to Nzila:
- AI making employment / case-handling decisions about workers (union-eyes)
- AI determining access to financial services (cfo, partners)
- AI used in critical infrastructure or safety-of-life systems
- AI used in education credentialing
- AI processing biometric data for identification
- AI generating content used for legal proceedings without human review

**Required:** AIGC + Legal + Privacy Lead + Security Lead approval; full PIA;
conformity assessment; continuous monitoring; incident plan; user disclosure;
human review; right to explanation.

### Tier 2 — Limited risk
AI that interacts with users (e.g., chatbots, voice assistants) or generates
synthetic content (transcripts, summaries). Mainly transparency obligations.

**Required:** Privacy Lead + Surface Owner approval; lightweight PIA;
"this is AI" disclosure; eval plan; reasoning context envelope.

### Tier 3 — Minimal risk
Internal-only AI on Internal-or-lower-tier data with no automated decisions.
Examples: code assistance, internal doc search, internal summarization.

**Required:** Inventory entry; standard SDLC.

## 2. Classification rubric

Answer in order. First "Yes" determines the tier.

| # | Question | If Yes |
|---|----------|--------|
| 1 | Does the use case fall into an EU AI Act Article 5 prohibition? | **Tier 0** (reject) |
| 2 | Does the AI make or substantially influence a decision that materially affects a person's rights, employment, finances, education, healthcare, or services? | **Tier 1** |
| 3 | Is the input or output Restricted-tier data (PHI, payment data, biometrics)? | **Tier 1** |
| 4 | Is the AI used in critical infrastructure or safety-of-life paths? | **Tier 1** |
| 5 | Does the AI directly interact with a user or generate content presented to users? | **Tier 2** |
| 6 | Otherwise — internal use only, advisory, non-personal-data scope | **Tier 3** |

## 3. Per-surface classification (initial)

| Surface | App / Package | Tier | Rationale | Approval status | PIA |
|---------|---------------|:----:|-----------|:---------------:|-----|
| Console AI — generate / extract / RAG | `apps/console` via `@nzila/ai-sdk` | 2 | User-facing AI assistance, Confidential data | Surface Owner / Privacy Lead | [console-rag](../privacy/ai-pia/surfaces/console-rag.md); per-feature PIAs TODO |
| Console AI — actions (propose / approve) | `apps/console` via `@nzila/ai-sdk` (action endpoints) | **1** if non-reversible OR affects external systems; else **2** | Action paths are higher-stakes; existing attestation system mitigates | Pending — AIGC required | TODO |
| Console ML | `apps/console` via `@nzila/ml-sdk` | 2 | Decision-support outputs | Surface Owner | TODO |
| Memora Companion (planned) | via `@nzila/ai-sdk` | **1** | Healthcare-adjacent; possibly health data | **AIGC required** before launch | TODO |
| Zonga Voice (Whisper) | `apps/zonga` | 2 | User-facing transcription; possible PHI in content | Privacy Lead | [zonga-voice](../privacy/ai-pia/surfaces/zonga-voice.md) |
| Union-Eyes Triage / Cognition | `apps/union-eyes`, `packages/ue-cognition` | **1** | May influence case handling for workers; PHI possible | **AIGC required** | [ue-cognition](../privacy/ai-pia/surfaces/union-eyes-cognition.md) (R1 must close) |
| Cognition Layer Phase 1 (interpretable) | `packages/platform-cognition-core` | 2 | Memory/state/trajectory; explainable algorithms | Surface Owner | TODO |
| Cognition Layer Phase 2 (trained models) | `packages/platform-cognition-core` (future) | **1** | Trained ML in decision paths | **AIGC required** before swap | TODO |
| CFO finance assistant (if/when) | `apps/cfo` | **1** if it influences financial decisions | Financial impact | n/a yet | n/a |
| Partners pipeline scoring (if/when) | `apps/partners` | **1** if affects partner access/terms | Material commercial effect | n/a yet | n/a |
| Internal coding assistance | dev | 3 | Internal, code only | n/a | n/a |

This table is the source of truth. Updates require AIGC ratification.

## 4. Re-classification triggers

A surface MUST be re-classified when:

- Model provider or model family changes
- The data tier sent to the model changes
- The output is used in a new downstream action
- A new jurisdiction applies (e.g., onboarding EU members)
- An incident reveals a previously unrecognized risk
- An external regulation changes the rubric

## 5. Sources

- EU AI Act Regulation (EU) 2024/1689, Articles 5, 6, Annex III
- NIST AI RMF 1.0
- ISO/IEC 42001:2023 §6 risk management
- Canada AIDA (proposed)
