# @nzila/platform-agent-workflows

Agent workflow definitions, step execution, and recommendation generation for the NzilaOS platform.

## Capabilities

| Area | Functions |
|------|-----------|
| **Workflows** | `createWorkflow` — define multi-step agent workflows |
| **Runner** | `executeStep` — execute individual workflow steps |
| **Recommendations** | `generateRecommendations` — produce actionable recommendations from workflow results |

## Source Layout

```
src/
├── recommendations.ts
├── types.ts
├── workflowRunner.ts
└── index.ts
```

## Exports

- `.` — barrel exports
- `./types` — workflow type definitions and schemas
- `./runner` — workflow step executor
- `./recommendations` — recommendation generator
