# AI Actions — Phase C Architecture

> Nzila OS AI Control Plane: deterministic action engine with evidence-grade attestation.

## Overview

Phase C introduces a full **propose → policy-check → approve → execute → attest** lifecycle for AI-driven actions. Every action is:

- **Schema-validated** (Zod) before execution
- **Policy-checked** (deterministic, no LLM) against capability profiles
- **Audited** with hash-chained `audit_events`
- **Attested** with SHA-256 self-referencing JSON attestation documents
- **Evidence-pack-eligible** for governance and compliance reporting

## Architecture

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Console  │────▶│  API Routes   │────▶│  Policy Check │
│   UI      │     │  /api/ai/     │     │  (no LLM)     │
└──────────┘     │  actions/*    │     └──────┬───────┘
                  └──────┬───────┘            │
                         │                    ▼
                         │            ┌──────────────┐
                         │            │  Auto-approve │
                         │            │  (low risk)   │
                         │            └──────┬───────┘
                         ▼                    │
                  ┌──────────────┐            │
                  │  Execute      │◀───────────┘
                  │  Engine       │
                  └──────┬───────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
  ┌──────────────┐ ┌──────────┐ ┌──────────────┐
  │ Stripe Tool  │ │ Blob Tool│ │ Knowledge    │
  │ (reports)    │ │ (upload) │ │ Tool (embed) │
  └──────┬───────┘ └────┬─────┘ └──────┬───────┘
         │              │              │
         ▼              ▼              ▼
  ┌──────────────────────────────────────────┐
  │          Attestation Engine               │
  │  (SHA-256, hash-chain, documents)        │
  └──────────────────────────────────────────┘
```

## Confirmed Action Types

| Action Type | Risk Tier | Auto-approve | Package |
|---|---|---|---|
| `finance.generate_stripe_monthly_reports` | low | Yes | `@nzila/tools-runtime` |
| `ai.ingest_knowledge_source` | low | Yes | `@nzila/tools-runtime` |

## Database Schema

### New enums

- `ai_action_status` — expanded: `proposed`, `policy_checked`, `awaiting_approval`, `approved`, `executing`, `executed`, `failed`, `rejected`, `expired`
- `ai_risk_tier` — `low`, `medium`, `high`
- `ai_action_run_status` — `started`, `success`, `failed`
- `ai_knowledge_ingestion_status` — `queued`, `chunked`, `embedded`, `stored`, `failed`

### New tables

**`ai_action_runs`** — One run per execution attempt.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `action_id` | uuid | FK → `ai_actions.id` |
| `entity_id` | uuid | FK → `entities.id` |
| `status` | enum | `started`, `success`, `failed` |
| `started_at` | timestamp | Auto-set on creation |
| `finished_at` | timestamp | Set on completion |
| `tool_calls_json` | jsonb | Sanitized tool call trace |
| `output_artifacts_json` | jsonb | Output document IDs, etc. |
| `attestation_document_id` | uuid | FK → `documents.id` |
| `error` | text | Error message if failed |

**`ai_knowledge_ingestion_runs`** — Tracks ingestion lifecycle.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `entity_id` | uuid | FK → `entities.id` |
| `source_id` | uuid | FK → `ai_knowledge_sources.id` |
| `status` | enum | `queued` → `chunked` → `embedded` → `stored` |
| `metrics_json` | jsonb | Chunk count, embedding count, etc. |
| `error` | text | Error message if failed |

### Modified tables

**`ai_actions`** — Added columns:

| Column | Type | Description |
|---|---|---|
| `risk_tier` | enum | `low` (default) |
| `policy_decision_json` | jsonb | Full policy check output |
| `approvals_required_json` | jsonb | Required approver roles |
| `evidence_pack_eligible` | boolean | `true` (default) |

## Proposal Schemas (Zod)

### `FinanceStripeMonthlyReportsProposalSchema`

```typescript
{
  entityId: z.string().uuid(),
  appKey: z.string(),
  profileKey: z.string(),
  period: {
    startDate: "YYYY-MM-DD",
    endDate: "YYYY-MM-DD",
    periodLabel: "2026-01",
    periodId?: uuid
  },
  ventureId?: uuid,
  outputs: ["revenue_summary", "payout_recon", ...],
  evidence: {
    storeUnderEvidencePack: true,
    evidencePathHint?: string
  }
}
```

### `AiIngestKnowledgeSourceProposalSchema`

```typescript
{
  entityId: z.string().uuid(),
  appKey: z.string(),
  profileKey: z.string(),
  source: {
    sourceType: "manual_text" | "blob_document" | "url",
    title: string,
    documentId?: uuid,  // required for blob_document
    url?: string,       // required for url
    text?: string       // required for manual_text
  },
  ingestion: {
    chunkSize: 900,     // 100–4000
    chunkOverlap: 150,  // 0–1000
    embeddingBatchSize: 64,
    maxChunks: 5000
  },
  retention: {
    dataClass: "public" | "internal" | "sensitive" | "regulated",
    retentionDays: 90
  },
  citations: { requireCitations: true }
}
```

## Policy Check

Deterministic (no LLM). Checks:

1. Capability profile exists and is enabled
2. `actions_propose` feature enabled
3. `actionType` allowed by `toolPermissions`
4. `dataClass` allowed for ingestion actions
5. Budget not blocked
6. Risk tier → auto-approve or require human approval

All results are written to `audit_events` as `ai.action_policy_checked`.

## Execution Engine

`executeAction(actionId, actorClerkUserId)`:

1. Load action, assert `status === 'approved'`
2. Create `ai_action_runs` row (`started`)
3. Move action to `executing`
4. Dispatch by `actionType`:
   - **Stripe**: call `generateMonthlyReports()` → idempotent → returns artifacts
   - **Knowledge**: call `ingestKnowledgeSource()` → chunk → embed → store
5. Generate attestation JSON
6. Store attestation as document + audit event
7. Finalize run (`success`) and action (`executed`)
8. On error: mark both as `failed`, write `ai.action_failed` audit event

## Attestation

Every execution produces an attestation document:

```json
{
  "attestationVersion": "1.0",
  "actionId": "...",
  "runId": "...",
  "hashes": {
    "proposalHash": "<SHA-256 of proposal JSON>",
    "attestationHash": "<SHA-256 of attestation minus self-hash>"
  },
  "toolTrace": {
    "toolCallsJson": [...]
  },
  "links": {
    "evidencePackEligible": true
  }
}
```

Stored at: `exports/{entityId}/attestations/{YYYY}/{MM}/{actionType}/{runId}/attestation.json`

## API Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/ai/actions/propose` | Submit a proposal for any action type |
| POST | `/api/ai/actions/approve` | Approve/reject a pending action |
| POST | `/api/ai/actions/execute` | Execute an approved action |
| POST | `/api/ai/actions/finance/stripe-monthly-reports` | Convenience: propose + execute Stripe reports |
| POST | `/api/ai/actions/knowledge/ingest` | Convenience: propose + execute knowledge ingestion |

## Evidence Pack Integration

The `collectAiActionEvidence()` function gathers all attestation documents, ingestion reports, and linked documents for a given entity + period. It returns an `AiActionsEvidenceAppendix` structure suitable for inclusion in evidence packs.

```typescript
import { collectAiActionEvidence } from '@nzila/ai-core/actions/evidence-pack'

const appendix = await collectAiActionEvidence(entityId, '2026-02')
// → { actions: [...], summary: { totalActions, attestationCount, ... } }
```

## Tools Runtime

`@nzila/tools-runtime` provides:

- **`sanitize()`** — Deep-redact sensitive keys before logging
- **`blobTool`** — Upload/download with tool-call logging + deterministic path builders
- **`stripeTool`** — Idempotent Stripe report generation (checks existing reports first)
- **`knowledgeTool`** — Deterministic chunking → embedding → storage

All tool operations produce `ToolCallEntry` log entries (sanitized hashes, no raw secrets).

## Testing

```powershell
# Unit tests (Zod, chunker, sanitize, attestation, paths)
pnpm --filter @nzila/ai-core test
pnpm --filter @nzila/tools-runtime test
```

Test coverage:

| Test file | Covers |
|---|---|
| `schemas.test.ts` | Zod proposal validation, defaults, rejections |
| `attestation.test.ts` | Attestation creation, hashing, field presence |
| `chunker.test.ts` | Deterministic chunking, overlap, limits, edge cases |
| `sanitize.test.ts` | Secret redaction, hash determinism, tool call entry |
| `blobTool.test.ts` | Path builder correctness |
| `integration.test.ts` | Stripe idempotency, chunk+embed flow, attestation creation |

## Packages Modified

| Package | Changes |
|---|---|
| `@nzila/db` | Schema expansion, migration `0001_phase_c_actions.sql` |
| `@nzila/ai-core` | Zod schemas, policy, execution, attestation, evidence-pack |
| `@nzila/tools-runtime` | **New** — sanitize, blobTool, stripeTool, knowledgeTool |
| `apps/console` | API routes, dashboard pages |

## Migration

```sql
-- Apply with drizzle-kit or manually:
-- packages/db/drizzle/0001_phase_c_actions.sql
```

## Audit Events

| Action | Target Type | When |
|---|---|---|
| `ai.action_proposed` | `ai_action` | Proposal created |
| `ai.action_policy_checked` | `ai_action` | Policy evaluation |
| `ai.action_approved` | `ai_action` | Human or auto approval |
| `ai.action_executing` | `ai_action` | Execution started |
| `ai.action_executed` | `ai_action` | Execution succeeded |
| `ai.action_failed` | `ai_action` | Execution failed |
| `ai.attestation_stored` | `document` | Attestation doc created |
