# Nzila OS — AI Control Plane

> **Version**: v1.0  
> **Status**: Active  
> **Last Updated**: 2026-02-19  

## Overview

The AI Control Plane is the **single gateway** through which all Nzila apps access AI capabilities. No app calls model providers directly. Instead, every AI request flows through the console's `/api/ai/*` endpoints, which enforce:

1. **Capability Profiles** — per-app, per-feature policy gates
2. **PII Redaction** — strict/balanced/off per profile
3. **Budget Enforcement** — monthly spend limits with auto-blocking
4. **Full Audit Logging** — hash-chained `audit_events` for every request
5. **Prompt Versioning** — registry with activation/rollback
6. **RAG** — pgVector-powered retrieval augmented generation
7. **AI Actions** — propose/approve workflow (v1: proposals only)

## Architecture

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Memora     │   │ Union Eyes  │   │    Cora      │
│   (app)      │   │   (app)     │   │   (app)      │
└──────┬───────┘   └──────┬──────┘   └──────┬───────┘
       │                  │                  │
       │  @nzila/ai-sdk   │                  │
       ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────┐
│              Nzila OS Console                       │
│              /api/ai/* endpoints                    │
├─────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌─────────┐ ┌────────┐ ┌───────────┐│
│  │ Gateway  │ │ Budget  │ │ Redact │ │  Prompts  ││
│  │ Router   │ │ Check   │ │ Engine │ │  Registry ││
│  └────┬─────┘ └─────────┘ └────────┘ └───────────┘│
│       │                                            │
│  ┌────▼─────┐ ┌─────────────────┐ ┌──────────────┐│
│  │ Provider │ │  Logging +      │ │  Audit       ││
│  │ (Azure)  │ │  Hash Chain     │ │  Events      ││
│  └──────────┘ └─────────────────┘ └──────────────┘│
└─────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────┐
│ Azure OpenAI │
└──────────────┘
```

## Packages

| Package | Purpose |
|---------|---------|
| `@nzila/ai-core` | Server-side gateway, providers, redaction, budgets, logging |
| `@nzila/ai-sdk` | App-facing typed client (fetch wrapper, streaming) |
| `@nzila/db` (schema/ai) | Drizzle tables for all AI state |

## Database Tables

| Table | Purpose |
|-------|---------|
| `ai_apps` | Registered Nzila apps that use AI |
| `ai_capability_profiles` | Per-app policy: allowed features, models, data classes, budgets |
| `ai_prompts` | Prompt registry (app + promptKey) |
| `ai_prompt_versions` | Versioned templates with activation/rollback |
| `ai_requests` | Full request log with SHA-256 hashes |
| `ai_request_payloads` | Optional raw payloads (encrypted for sensitive data) |
| `ai_usage_budgets` | Monthly spend tracking per app/profile |
| `ai_knowledge_sources` | RAG document sources |
| `ai_embeddings` | pgVector chunk storage (1536-dim) |
| `ai_actions` | Proposed AI actions (Phase B) |

## API Endpoints

| Method | Path | Feature |
|--------|------|---------|
| POST | `/api/ai/generate` | Non-streaming generation |
| POST | `/api/ai/chat` | Non-streaming chat |
| POST | `/api/ai/chat/stream` | SSE streaming chat |
| POST | `/api/ai/embed` | Embedding generation |
| POST | `/api/ai/extract` | Schema-validated JSON extraction |
| POST | `/api/ai/rag/query` | Vector search + LLM answer |
| POST | `/api/ai/actions/propose` | Propose an AI action |
| POST | `/api/ai/actions/approve` | Approve/reject an action |
| GET/POST | `/api/ai/prompts` | Prompt registry CRUD |
| GET/POST/PATCH | `/api/ai/prompts/versions` | Version management |

## Policy Enforcement Order

Every request goes through this pipeline:

1. **Verify entity membership** (Clerk RBAC)
2. **Load capability profile** (entityId + appKey + env + profileKey)
3. **Check feature + modality allowed**
4. **Check data class allowed**
5. **Apply PII redaction** (per profile's `redactionMode`)
6. **Check budgets / rate limits**
7. **Call provider** (Azure OpenAI)
8. **Log** → `ai_requests` + `ai_request_payloads` + `audit_events`

## Environment Variables

```env
# Required — Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=sk-...
AZURE_OPENAI_API_VERSION=2024-06-01
AZURE_OPENAI_DEPLOYMENT_TEXT=gpt-4o
AZURE_OPENAI_DEPLOYMENT_EMBEDDINGS=text-embedding-ada-002

# Defaults
AI_DEFAULT_PROVIDER=azure_openai
AI_LOG_PAYLOADS=true
AI_REDACTION_MODE=strict
AI_MAX_TOKENS_DEFAULT=1024
AI_TEMPERATURE_DEFAULT=0.2

# Optional — encryption for sensitive payloads
AI_ENCRYPTION_KEY=<64-char-hex-string>

# Blob containers
AZURE_STORAGE_CONTAINER_EVIDENCE=evidence
AZURE_STORAGE_CONTAINER_EXPORTS=exports
```

## SDK Usage (Apps)

```typescript
import { createAiClient } from '@nzila/ai-sdk'

const ai = createAiClient({
  baseUrl: process.env.NZILA_CONSOLE_URL!,
  getToken: () => clerkSession.getToken(),
})

// Non-streaming generate
const result = await ai.generate({
  entityId: 'uuid',
  appKey: 'memora',
  profileKey: 'clinical',
  promptKey: 'companion_greeting',
  input: 'Hello, I need help today.',
  dataClass: 'sensitive',
})

// Streaming chat
const { stream } = await ai.chatStream({
  entityId: 'uuid',
  appKey: 'memora',
  profileKey: 'default',
  input: [
    { role: 'system', content: 'You are a helpful companion.' },
    { role: 'user', content: 'How are you?' },
  ],
  dataClass: 'internal',
})

for await (const chunk of stream) {
  process.stdout.write(chunk.delta)
}

// Structured extraction
const invoice = await ai.extract({
  entityId: 'uuid',
  appKey: 'console',
  profileKey: 'default',
  promptKey: 'extract_invoice',
  input: 'Invoice #12345...',
  dataClass: 'internal',
})
console.log(invoice.data) // { invoiceNumber: "12345", ... }
```

## Evaluation Harness

```bash
# Run golden tests against staging
npx tsx tooling/ai-evals/run-evals.ts \
  --baseUrl http://localhost:3001 \
  --token <clerk_token> \
  --appKey memora
```

Reports are saved to `tooling/ai-evals/report.json`.

**Metrics tracked:**
- Schema validation pass rate (extract)
- Refusal rate  
- Average latency
- Total cost estimates

## Evidence Pack Integration

AI outputs become evidence artifacts **only** when explicitly stored:

```typescript
import { storeAiArtifactAsDocument } from '@nzila/ai-core'

await storeAiArtifactAsDocument({
  content: approvedDraftMarkdown,
  entityId: 'uuid',
  classification: 'confidential',
  category: 'resolution',
  title: 'AI-drafted Board Resolution',
  uploadedBy: userId,
})
```

This creates a `documents` row, uploads to Azure Blob with SHA-256, and appends an `ai.artifact_stored` audit event.

## Phase B: AI Actions

Actions are **proposed** by AI and **approved** by humans. No execution in v1.

```
User input → LLM proposes action → validate schema → store as "proposed"
                                                            ↓
                                              Admin approves/rejects
                                                            ↓
                                              audit_event logged
```

## Security

- **Never log secrets** in `ai_requests` or `ai_request_payloads`
- **Encrypt payloads** when `dataClass` is `sensitive` or `regulated` (AES-256-GCM)
- **Payload-off mode**: set `AI_LOG_PAYLOADS=false` for sensitive workloads
- **Redaction**: PII patterns removed before sending to provider
- **Budget blocking**: automatic at 100% spend, warning at 80%
