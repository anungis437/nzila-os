# @nzila/platform-compliance-snapshots

Compliance control snapshots with blockchain-style chaining and verification. Enables tamper-evident compliance audit trails.

## Capabilities

| Area | Functions |
|------|-----------|
| **Collector** | `ComplianceCollector` — gather compliance data from platform sources |
| **Chain** | `SnapshotChain` — blockchain-style snapshot chaining with integrity verification |
| **Generator** | `SnapshotGenerator` — generate point-in-time compliance snapshots |
| **Verifier** | `ComplianceVerifier` — verify snapshot chain integrity and compliance status |

## Source Layout

```
src/
├── chain.ts
├── collector.ts
├── generator.ts
├── types.ts
├── verifier.ts
├── index.ts
└── __tests__/
```

## Exports

- `.` — barrel exports
- `./types` — snapshot type definitions
- `./collector` — compliance data collection
- `./chain` — snapshot chain management
- `./generator` — snapshot generation
- `./verifier` — chain verification
