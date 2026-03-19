# @nzila/platform-ai-governance

AI model registry, prompt versioning, decision logging, and human review management for governed AI operations.

## Capabilities

| Area | Functions |
|------|-----------|
| **Model Registry** | `registerModel` — register and track AI models |
| **Prompt Versioning** | `createPromptVersion` — version-controlled prompt management |
| **Decision Log** | `logAIDecision` — structured AI decision audit trail |
| **Human Review** | `flagForReview` — human-in-the-loop review workflows |

## Source Layout

```
src/
├── decisionLog.ts
├── humanReview.ts
├── modelRegistry.ts
├── promptVersioning.ts
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
