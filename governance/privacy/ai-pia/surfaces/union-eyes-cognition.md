# AI PIA — Union-Eyes Cognition

**PIA ID:** PIA-2026-003
**Version:** 0.1
**Status:** DRAFT
**Created:** 2026-04-28
**Surface Owner:** Union-Eyes Lead
**Privacy Lead:** _TBD_
**Security Lead:** _TBD_

---

## 1. Surface Summary

- **What it does:** Provides AI-assisted case timeline, claim summarization, and representation guidance over union member case data.
- **Where it lives:** `packages/ue-cognition`, consumed by `apps/union-eyes` Next.js + Django sidecar.
- **Users / data subjects:** Union representatives acting on behalf of union members; data subjects are union members.
- **Lawful basis:** Performance of contract (representation services); explicit consent at member onboarding for AI-assisted case handling.
- **Automated decision-making?** No — outputs are advisory; representative makes the decision.

## 2. Data Flow

| Stage | Data category | PII? | PHI? | Storage | Region | Retention |
|-------|--------------|------|------|---------|--------|-----------|
| Case data | Member identifiers, grievance details, employer info, possible health context | Yes | Possible | Postgres `cases.*` | Canada Central | Per retention policy (years) |
| Cognition call | Case summary + question | Yes | Possible | In-flight | East US | zero-retention |
| Output | Advisory text + reasoning envelope | derived | possibly | Postgres `cognition_outputs` | Canada Central | Linked to case retention |

- **Model provider / version:** Azure OpenAI `gpt-4.1-mini` (East US).
- **Sub-processors:** Microsoft Azure.

## 3. Info-Tech 12-Domain Snapshot (highlights)

| # | Domain | Maturity | Notes |
|---|--------|---------|-------|
| 2 | Regulatory Compliance | 3 | PIPEDA primary; provincial labour relations acts; HIPAA-adjacent for any health context. |
| 3 | Data Process & Handling | 3 | Org scoping enforced; case-level RBAC. |
| 6 | Notices and Consent | 2 | **GAP:** member-facing notice that AI assists in case handling needs to be added at intake. |
| 8 | Privacy by Design | 3 | Default-on minimization (only relevant case fields sent to model). |
| 9 | Information Security | 4 | Auth + org-scope + audit trail. |
| 12 | Program Measurement | 2 | **GAP:** no metric for AI-assisted vs unassisted outcomes. |

## 5. Risk Register

| ID | Risk | L | I | Inherent | Mitigation | Residual |
|----|------|---|---|----------|------------|----------|
| R1 | PHI sent to model without explicit member notice | M | H | HIGH | Add intake consent; redact obvious PHI before send | MED → close before approval |
| R2 | Cross-org leakage via shared model context | L | H | MED | Per-call org scope; never batch across orgs | LOW |
| R3 | Representative over-relies on AI output | M | M | MED | Mandatory "advisory only" UI banner + reasoning envelope visible | LOW |

## 6. Algorithmic Traceability (PIPEDA Proposal #9)

- Reasoning context envelope MUST accompany every cognition output (model, prompt template, retrieved evidence ids, confidence).
- Envelope is persisted with the case and viewable by the member upon DSR.

## 7. Data Subject Rights

| Right | Supported? | How |
|-------|-----------|-----|
| Access | Yes | Member portal exposes case + AI outputs |
| Erasure | Conditional | Subject to legal-hold and retention obligations |
| Object to AI processing | TODO | Need opt-out flag at member level; default = AI assistance enabled per consent |

## 8. Approvals

_Pending — R1 must be reduced from MED to LOW before APPROVED status._
