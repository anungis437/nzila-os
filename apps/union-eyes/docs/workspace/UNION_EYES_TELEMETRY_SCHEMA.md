# Union Eyes Workspace Telemetry Schema

> Pattern: Club360-style workspace consolidation (see
> [UNION_EYES_WORKSPACE_DOCTRINE.md](./UNION_EYES_WORKSPACE_DOCTRINE.md))

Following the Club360 pattern, workspace telemetry exists for **one purpose
only**: to validate that the workspace is useful and that legacy routes can be
safely subordinated. It is **not** user surveillance, productivity scoring, or
behavioral profiling.

## Allowed events

```
workspace.view          — the workspace surface was opened
tab.view                — a workspace tab was opened
deep_work.clicked       — a Deep Work link was clicked
legacy_page.visited     — a legacy page was visited via the workspace
absorbed_by_workspace   — a legacy route's traffic is now flowing through the workspace
```

### Client-emitted vs derived

To keep the telemetry honest and audit-safe, events are split:

```
Client-emitted (sent by the browser, accepted by the endpoint):
- workspace.view
- tab.view
- deep_work.clicked
- legacy_page.visited

Derived only (NEVER sent by the client):
- absorbed_by_workspace
```

`absorbed_by_workspace` is a **conclusion**, not a raw event. It must be computed
server-side / analytically from repeated `deep_work.clicked` and
`legacy_page.visited` patterns. If the client emitted it directly it would be a
self-reported claim rather than evidence. The telemetry endpoint therefore
**rejects** `absorbed_by_workspace` (and any other non-client event) with `400`.

## Allowed payload keys

An event payload **may** include only:

```
workspace   — workspace identifier (constant: "union-eyes")
tab         — canonical tab id (e.g. "overview", "continuity")
route       — destination route path WITHOUT identifiers (e.g. "/dashboard/cases")
timestamp   — ISO-8601 emission time
```

The endpoint **strips** any key not in this allow-list before recording. This is
defense-in-depth: even if a caller sends extra fields, they are dropped.

### Route guard (reject dynamic routes)

`route` is validated by `isAllowedTelemetryRoute()` before recording. A route is
accepted **only** if:

- it is absolute (starts with `/`), and
- no path segment looks like a UUID, a numeric id, or a long hex id, and
- it matches a **known static workspace route** (the deep-work routes defined in
  `workspace-config.ts`).

Anything else — `/dashboard/cases/123`, a UUID-bearing path, a deeper/unknown
route — is **dropped**. This structurally prevents case, member, or grievance
identifiers from leaking through the `route` field.

## Forbidden payload content

Telemetry payloads **must not** include:

- member identifiers
- case identifiers
- grievance details
- user productivity data
- surveillance-style behavior profiles

To enforce this structurally, `route` values are **static route templates**
(e.g. `/dashboard/cases`), never instance routes (e.g. `/dashboard/cases/abc-123`).
The emitter only ever sends canonical tab routes from the workspace config.

## Transport

- Client emitter: `lib/hooks/use-workspace-telemetry.ts` (client events only)
- Endpoint: `POST /api/workspace/telemetry`
- Failures are swallowed client-side and **never** block the user.
- The endpoint rejects non-client events, validates the event name, allow-lists
  payload keys, and route-guards the `route` field, then logs a structured,
  PII-free record via the app logger. No new database table is introduced for v1
  (keeps the change boring, deterministic, and migration-free).

## Event → meaning

| Event | Meaning | Validates |
| --- | --- | --- |
| `workspace.view` | user opened the workspace | reach |
| `tab.view` | user opened a tab | which questions matter |
| `deep_work.clicked` | user followed a deep-work link | workspace → execution handoff works |
| `legacy_page.visited` | a legacy page was reached via workspace | subordination is happening |
| `absorbed_by_workspace` | legacy traffic now flows through workspace | retirement readiness |

Only after `absorbed_by_workspace` signals are consistently observed for a legacy
route should that route's standalone navigation be considered for retirement —
exactly as in the Club360 pattern.
