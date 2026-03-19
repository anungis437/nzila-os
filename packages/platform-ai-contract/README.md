# @nzila/platform-ai-contract

Type definitions and validation schemas for AI output contracts — insights, anomalies, decisions, and recommendations.

## Capabilities

| Area | Functions |
|------|-----------|
| **Validation** | `isValidAIOutput`, `hasRequiredBaseFields` — contract compliance checks |
| **Fallbacks** | `createFallbackOutput` — safe fallback generation for invalid AI outputs |
| **Schemas** | Zod schemas for all AI output types |

## Source Layout

```
src/
├── schemas.ts
├── types.ts
└── index.ts
```

## Exports

- `.` — barrel exports
- `./schemas` — Zod validation schemas
- `./types` — TypeScript type definitions
