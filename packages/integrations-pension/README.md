# @nzila/integrations-pension

Pension provider integration clients for OTPP and CPP.

## Capabilities

| Area | Functions |
|------|-----------|
| **OTPP** | `createOtppClient` — Ontario Teachers' Pension Plan integration |
| **CPP** | `createCppClient` — Canada Pension Plan integration |
| **Types** | Shared pension data types and mappers |

## Source Layout

```
src/
├── cpp.ts
├── otpp.ts
├── types.ts
└── index.ts
```

## Exports

- `.` — barrel exports
- `./types` — shared type definitions
- `./otpp` — OTPP client
- `./cpp` — CPP client
