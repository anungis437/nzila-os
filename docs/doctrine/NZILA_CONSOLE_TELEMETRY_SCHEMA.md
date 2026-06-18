# Nzila Console — Telemetry Schema

> Status: **v1 — Foundational**
> Companion docs: [Workspace Doctrine](./NZILA_CONSOLE_WORKSPACE_DOCTRINE.md) · [Tab Schema](./NZILA_CONSOLE_TAB_SCHEMA.md) · [Workspace Map](./NZILA_CONSOLE_WORKSPACE_MAP.md)

Console is observable from day one. Telemetry tells us which workspaces and sub-tabs earn
their place, so the six-workspace surface evolves on evidence rather than opinion.

The v1 implementation mirrors the existing Web Vitals reporter: a small client emitter
sends `sendBeacon` payloads to an endpoint that validates them and writes to a bounded,
dependency-free in-process ring buffer. No DB, no Redis, no PII.

- Emitter: `apps/console/components/workspace-telemetry.tsx`
- Endpoint: `apps/console/app/api/_telemetry/console/route.ts`
- Store: `apps/console/lib/console-telemetry/store.ts`

---

## Event taxonomy

All events share an envelope and a `type`. Field names are stable; new fields may be added
but existing ones must not change meaning.

### Envelope

| Field | Type | Notes |
| --- | --- | --- |
| `type` | string | One of the event types below |
| `workspace` | string | One of: `overview`, `portfolio`, `observatory`, `sales`, `ventures`, `operations`, `settings` |
| `tab` | string \| null | The active `?tab=` sub-tab, or `null` when the workspace has none |
| `ts` | number | Epoch milliseconds (set server-side on receipt) |

### Event types (v1)

| `type` | Fired when | Extra fields |
| --- | --- | --- |
| `workspace.view` | A workspace surface mounts | — |
| `tab.view` | A sub-tab becomes active (mount or `?tab=` change) | — |

> v1 intentionally ships only navigation events. Action-level events
> (`venture.open`, `deal.open`, `link.out`) are reserved for v2 and must be added to this
> table before they are emitted.

---

## Validation rules (endpoint)

1. Reject payloads larger than **4 KB**.
2. Reject batches larger than **16** events.
3. `type` must be in the allowed set: `workspace.view`, `tab.view`.
4. `workspace` must be in the allowed workspace set (above). Otherwise the event is dropped.
5. `tab` is truncated to 64 chars; non-string → `null`.
6. `ts` is always assigned server-side; any client-supplied `ts` is ignored.
7. The endpoint accepts anonymous beacons (sendBeacon cannot carry auth on unload) and is
   rate-limited only by the size/batch caps above.

---

## Storage & retention (v1)

- **Ring buffer**, max **5000** events, O(1) push, oldest evicted first.
- In-process only — each replica holds its own slice. Acceptable for a self-monitoring
  surface; not a source of truth.
- No persistence across restarts. v2 may forward to `@nzila/platform-observability`.

### Read API

The store exposes a summary used by an internal ops view (not part of the six workspaces):

| Function | Returns |
| --- | --- |
| `recordConsoleEvent(event)` | void — push one validated event |
| `summarizeWorkspaceViews(windowMs?)` | per-workspace and per-tab view counts in the window |

---

## Privacy

- **No PII.** Only workspace/tab identifiers and timestamps are recorded.
- No user id, no IP, no account name in the telemetry payload.
- This schema is the allow-list: anything not listed here must not be emitted.

---

## Change control

Adding an event type or a field requires updating this document in the same change as the
emitter and endpoint. The allow-list in the endpoint MUST match the "Event types" table.
