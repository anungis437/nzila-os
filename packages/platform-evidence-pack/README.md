# @nzila/platform-evidence-pack

Evidence pack orchestration, export, verification, and retention management. Produces tamper-evident evidence bundles for compliance and audit.

## Capabilities

| Area | Functions |
|------|-----------|
| **Orchestrator** | `EvidencePackOrchestrator` — coordinate evidence collection across sources |
| **Exporter** | `exportPack` — export evidence packs to storage |
| **Verifier** | `verifyPack` — verify evidence pack integrity |
| **Retention** | `RetentionManager` — manage evidence retention policies and lifecycle |

## Source Layout

```
src/
├── exporter.ts
├── orchestrator.ts
├── retention.ts
├── types.ts
├── verifier.ts
├── index.ts
└── __tests__/
```

## Exports

- `.` — barrel exports
- `./types` — evidence type definitions
- `./orchestrator` — evidence collection orchestration
- `./exporter` — export utilities
- `./verifier` — integrity verification
- `./retention` — retention policy management
