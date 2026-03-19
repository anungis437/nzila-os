# @nzila/platform-export

Unified org data export. Aggregates data from all platform verticals (claims, revenue, quotes, audit events) and exports as CSV.

## Capabilities

| Area | Functions |
|------|-----------|
| **Export** | `exportOrgData` — aggregate and export org data as `OrgExportDataset` |

## Source Layout

```
src/
├── index.ts
└── __tests__/
```

## Exports

- `.` — barrel exports (single `exportOrgData` function)
