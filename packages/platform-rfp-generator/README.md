# @nzila/platform-rfp-generator

RFP (Request for Proposal) response generation with procurement proof integration and markdown rendering.

## Capabilities

| Area | Functions |
|------|-----------|
| **Generator** | `generateRfpResponse` — generate structured RFP responses from procurement data |
| **Rendering** | `renderRfpMarkdown` — render RFP responses as formatted markdown |

## Source Layout

```
src/
├── generator.ts
├── types.ts
├── index.ts
└── __tests__/
```

## Exports

- `.` — barrel exports
- `./types` — RFP type definitions and section schemas
- `./generator` — RFP response generation
