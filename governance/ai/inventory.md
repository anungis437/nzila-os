# AI Surface Inventory

**Doc ID:** AI-INV-2026-001
**Owner:** AI Governance Committee
**Cadence:** updated on every AI surface change; reconciled monthly

This is the canonical inventory of every production-bound AI capability in
Nzila. Maintained as Markdown for human review; a machine-readable variant
will be added at `governance/ai/inventory.json` once schemas stabilize.

## Schema

| Field | Description |
|-------|-------------|
| Surface | Human name |
| Path | Code path / package |
| Surface Owner | Accountable individual |
| Risk tier | per [risk-classification.md](risk-classification.md) |
| Provider / Model | e.g., Azure OpenAI / `gpt-4.1-mini` |
| Region | Inference region |
| Data tiers in | Highest data classification ingested |
| PIA | Link to per-surface PIA |
| Approval | AIGC decision date / Surface Owner only |
| Eval suite | Path or "TODO" |
| Status | DESIGN / DEVELOPMENT / PRODUCTION / DEPRECATED |

## Architecture invariant

All AI access at Nzila MUST go through `@nzila/ai-sdk` (`packages/ai-sdk`).
Direct imports from `@nzila/ai-core/providers/*` or raw OpenAI/Azure SDK
calls are **prohibited** — they bypass the governance control plane
(profiles, budgets, redaction, auditing, policy enforcement, attestation).
This is enforced by [`tooling/contract-tests/ai-integration.test.ts`](../../tooling/contract-tests/ai-integration.test.ts).

Reasoning context envelope is the existing `AiTrace` interface in
[`packages/ai-core/src/types.ts`](../../packages/ai-core/src/types.ts)
plus the per-response `requestId` / `model` / `provider` / token / cost fields.

The machine-readable mirror of the table below lives at
[`inventory.json`](inventory.json) and is enforced by
[`tooling/contract-tests/ai-inventory-integrity.test.ts`](../../tooling/contract-tests/ai-inventory-integrity.test.ts).

## Inventory

| Surface | App / Package | Owner | Tier | Provider / Model | Region | Data in | PIA | Approval | Evals | Status |
|---------|---------------|-------|:----:|------------------|--------|---------|-----|----------|-------|:------:|
| Console AI (generate / extract / RAG / actions) | `apps/console` via `@nzila/ai-sdk` | Console Lead | 1 (actions) / 2 (other) | Azure OpenAI `gpt-4.1-mini` + `text-embedding-3-small` | East US | Confidential | [console-rag](../privacy/ai-pia/surfaces/console-rag.md); per-feature PIAs TODO | Pending AIGC for actions; Surface Owner for the rest | [`tooling/ai-evals/datasets/console`](../../tooling/ai-evals/datasets/console) | DEV |
| Console ML | `apps/console` via `@nzila/ml-sdk` (`apps/console/lib/ml-server.ts`) | Console Lead | 2 | Internal ML | Local | Internal | TODO | Surface Owner | n/a | DEV |
| Memora Companion | (planned) via `@nzila/ai-sdk` | Memora Lead | 1 | Azure OpenAI | East US | Restricted (health) | TODO | **AIGC required** before launch | [`tooling/ai-evals/datasets/memora`](../../tooling/ai-evals/datasets/memora) | DESIGN |
| Union-Eyes Triage | `apps/union-eyes` via `@nzila/ai-sdk`; cognition in `packages/ue-cognition` | UE Lead | **1** | Azure OpenAI `gpt-4.1-mini` | East US | Restricted (PHI possible) | [ue-cognition](../privacy/ai-pia/surfaces/union-eyes-cognition.md) | **AIGC required (R1 open)** | [`tooling/ai-evals/datasets/union-eyes`](../../tooling/ai-evals/datasets/union-eyes) | DEV |
| Zonga Voice (Whisper) | `apps/zonga/app/api/voice-upload` | Zonga Lead | 2 | Azure OpenAI `whisper` v001 | East US 2 | Restricted (possible PHI) | [zonga-voice](../privacy/ai-pia/surfaces/zonga-voice.md) | Privacy Lead | TODO | DEV |
| Cognition Layer (memory / state / trajectory / consent) | `packages/platform-cognition-core` | Platform Lead | 2 | Internal interpretable models (Phase 1) | Local | Confidential+ | TODO | Surface Owner (Phase 1) → AIGC at Phase 2 (trained models) | n/a | PROD (Phase 1) |

## Approved providers

| Provider | Models in use | Contract | Data residency | Zero-retention |
|----------|---------------|----------|----------------|----------------|
| Microsoft Azure OpenAI | `gpt-4.1-mini`, `text-embedding-3-small`, `whisper` v001 | Azure DPA + Microsoft Products Terms | East US (text), East US 2 (whisper) | Yes (default) |

New providers require AIGC approval per [ai-policy.md](ai-policy.md) §7.

## Decommissioning

When a surface is retired:

1. Status set to DEPRECATED with sunset date
2. Surface code path marked deprecated
3. Pending DSARs against the surface honored before takedown
4. Logs retained per retention schedule
5. Inventory row marked RETIRED with date
