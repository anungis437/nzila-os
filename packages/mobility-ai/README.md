# @nzila/mobility-ai

AI copilot for mobility case management with governance policies, client summaries, program comparisons, and document checklists.

## Capabilities

| Area | Functions |
|------|-----------|
| **Copilot** | `generateClientSummary`, `generateProgramComparison` — AI-assisted case intelligence |
| **Governance** | `validateAiOutput` — AI output governance and compliance checks |
| **Checklists** | `generateDocumentChecklist` — automated document requirement analysis |

## Source Layout

```
src/
├── checklist.ts
├── copilot.ts
├── governance.ts
└── index.ts
```

## Exports

- `.` — barrel exports
- `./copilot` — AI copilot functions
- `./governance` — governance validation
