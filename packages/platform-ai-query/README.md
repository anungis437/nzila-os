# @nzila/platform-ai-query

Natural language query engine with intent classification, query execution, and evidence-backed responses.

## Capabilities

| Area | Functions |
|------|-----------|
| **Intent** | `classifyIntent` — natural language intent classification |
| **Parser** | `parseQuery` — structured query parsing from natural language |
| **Engine** | `executeQuery` — query execution against platform data |
| **Evidence** | `validateEvidenceBacking` — evidence-backed response verification |

## Source Layout

```
src/
├── evidenceBacked.ts
├── queryEngine.ts
├── types.ts
└── index.ts
```

## Exports

- `.` — barrel exports
- `./types` — query type definitions and schemas
- `./engine` — query execution engine
- `./evidence` — evidence backing utilities
