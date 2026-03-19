# @nzila/platform-governance

Governance status assessment, audit timeline tracking, and compliance validation for NzilaOS applications.

## Capabilities

| Area | Functions |
|------|-----------|
| **Status** | `assessAppCompliance` — evaluate governance status for an application |
| **Audit** | `recordAuditEvent` — record events to the governance audit timeline |
| **Validation** | `validateAppCompliance` — validate compliance against governance rules |
| **Reports** | `buildGovernanceReport` — generate governance compliance reports |

## Source Layout

```
src/
├── auditTimeline.ts
├── complianceValidator.ts
├── governanceStatus.ts
├── types.ts
└── index.ts
```

## Exports

- `.` — barrel exports
- `./types` — governance type definitions
- `./audit-timeline` — audit event timeline
- `./status` — governance status assessment
- `./validator` — compliance validation
