# @nzila/platform-ai-governance

AI model registry, prompt versioning, decision logging, and human review management for governed AI operations.

## Capabilities

| Area | Functions |
|------|-----------|
| **Model Registry** | `registerModel` — register and track AI models |
| **Prompt Versioning** | `createPromptVersion` — version-controlled prompt management |
| **Decision Log** | `logAIDecision` — structured AI decision audit trail |
| **Human Review** | `flagForReview` — human-in-the-loop review workflows |

## Persistence Architecture

By default, the package uses an in-memory store.

For durable persistence, initialize the PostgreSQL-backed store at process boot:

```ts
import { initializeGovernanceStoreFromEnv } from '@nzila/platform-ai-governance/postgres-store'

await initializeGovernanceStoreFromEnv()
```

Set `AI_GOVERNANCE_STORE=postgres` to activate persistence.

When active, all mutation paths (`registerModel`, `createPromptVersion`,
`logAIDecision`, `flagForReview`, review/clear operations) trigger persistence hooks.

## Source Layout

```
src/
├── decisionLog.ts
├── humanReview.ts
├── modelRegistry.ts
├── postgresStore.ts
├── promptVersioning.ts
├── store.ts
├── types.ts
└── index.ts
```

## Exports

- `.` — barrel exports
- `./types` — governance type definitions
- `./model-registry` — model registration
- `./prompt-versioning` — prompt version control
- `./decision-log` — decision audit logging
- `./review` — human review management
- `./postgres-store` — PostgreSQL governance store backend
