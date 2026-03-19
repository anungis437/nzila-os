# @nzila/platform-feature-flags

Environment-aware feature flag registry for experimental AI and governance features.

## Capabilities

| Area | Functions |
|------|-----------|
| **Registry** | `registerFlag`, `getAllFlags`, `resetFlags` — flag lifecycle management |
| **Evaluation** | `isFeatureEnabled` — environment-aware flag evaluation |

## Source Layout

```
src/
├── types.ts
├── index.ts
└── __tests__/
```

## Exports

- `.` — barrel exports
- `./types` — flag type definitions
