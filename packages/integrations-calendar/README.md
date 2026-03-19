# @nzila/integrations-calendar

Calendar integration adapters for Outlook and Google Calendar.

## Capabilities

| Area | Functions |
|------|-----------|
| **Outlook** | `createOutlookCalendarClient` — Microsoft Outlook calendar integration |
| **Google** | `createGoogleCalendarClient` — Google Calendar integration |
| **Types** | Shared calendar event types and adapter interfaces |

## Source Layout

```
src/
├── google.ts
├── outlook.ts
├── types.ts
└── index.ts
```

## Exports

- `.` — barrel exports
- `./types` — shared type definitions
- `./outlook` — Outlook adapter
- `./google` — Google Calendar adapter
