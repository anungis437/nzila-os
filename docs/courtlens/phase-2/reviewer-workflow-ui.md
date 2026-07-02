# CourtLens Reviewer Workflow UI — Phase 2E

## Status
- Phase 2C: read API implemented.
- Phase 2C.5: auth contract documented.
- Phase 2C.6: session-derived role + membership verification (auth blockers closed).
- Phase 2D: read-only tenant matter queue and detail pages.
- Phase 2E: **reviewer mutation controls on the detail page (this document)**.
- Phase 2F (public intake UI): not started.

## Actions Added

Three mutation endpoints and one client component:

### `POST /api/courtlens/matters/[matterId]/ai-summary-status`
- Advances the AI review packet lifecycle.
- Requires `incident.update`.
- Route always calls `updateAiSummaryStatus(..., actorType: 'human')` — the AI actor path is not exposed to public HTTP.
- Human-only approval enforcement lives inside the service (see `matter-service.ts:updateAiSummaryStatus`).
- Invalid transitions rejected with `400 AI_SUMMARY_TRANSITION_REJECTED`.
- Writes typed `courtlens_event` with `clEventType: 'ai_summary_status_changed'`.

### `POST /api/courtlens/matters/[matterId]/referral-status`
- Advances the referral lifecycle.
- Requires `incident.update`.
- `suggested → sent` is rejected (must pass through `approved`). Enforced by `isValidReferralTransition`.
- Writes typed `courtlens_event` with `clEventType: 'referral_status_changed'`.

### `POST /api/courtlens/matters/[matterId]/transition`
- Advances the ABR incident FSM state (matter status).
- Requires `incident.transition` (distinct from `incident.update`).
- `reason` is mandatory.
- Reuses `transitionMatterStatus` → `transitionIncident` → `assertValidTransition`.
- ABR FSM remains authoritative; CourtLens labels are display-only.

### `ReviewerActions` client component
- Located at `app/[locale]/dashboard/courtlens/matters/[matterId]/ReviewerActions.tsx`.
- Rendered inside the detail page after the legal boundary notice.
- Renders buttons only for permitted actions based on server-derived permissions.
- POSTs to the three mutation endpoints above.
- Calls `router.refresh()` after any successful mutation so the server re-derives all state from the updated event stream.

## Server-Side Authorization Model

Every mutation is enforced at the route layer:

1. `requireVerifiedOrgAccess(request)` — Phase 2C.6 trusted guard.
   - `userId` from platform-auth session.
   - `orgId` verified against `abr_users` (or session `orgId` match, or in-memory demo).
   - `x-org-id` is a selector; access is granted only via verified membership.
2. `requireVerifiedPermission(context, permission)` — checks the trusted role from the membership record against the required permission.
   - `x-abr-role` is ignored in production (Phase 2C.6 regression tests prove this).
3. Service-layer FSM guards — `isValidAiSummaryTransition`, `isValidReferralTransition`, `assertValidTransition` — reject invalid state transitions before any event is written.
4. Human-only approval — `updateAiSummaryStatus` rejects `approved`/`revised_by_human` when `actorType !== 'human'`. Public HTTP always passes `'human'` because the route only accepts authenticated user sessions.

The client component may hide buttons based on the server-derived permissions passed as props, **but this is defense-in-depth only**. Every mutation route independently re-enforces every check. Forging permissions client-side does nothing.

## Human Approval Gate

- `ai_summary_status` transitions `ai_draft → needs_verification → approved | rejected | revised_by_human`.
- Only `approved` and `revised_by_human` mark the packet as externalizable.
- The public HTTP mutation route always calls the service with `actorType: 'human'`.
- The service double-checks: transitions to `approved` or `revised_by_human` require a human actor. Any AI-triggered path (which does not exist on public HTTP) would be rejected with `Packet approval requires a human actor`.
- No client-side button, no matter how the DOM is manipulated, can call the service with `actorType: 'ai'`.

## Event / Audit Behavior

Every mutation writes at least two things:

1. A typed `courtlens_event` in `abr_incident_events.payload_json` (via `appendIncidentEvent`). This is the source of truth for CourtLens state — `deriveCourtLensFields` replays these events.
2. An `audit-log` entry via `logAuditEvent` including:
   - `action`: `courtlens.matter.ai_summary_status.updated` | `courtlens.matter.referral_status.updated` | `courtlens.matter.transition`
   - `actorUserId`, `orgId`
   - `role` — the trusted server-derived role
   - `membershipSource` — trust provenance (`session_org_match` | `abr_users_lookup` | `in_memory_demo` | `dev_unverified_fallback`)
   - `matterId`, `from`, `to`

The audit log distinguishes AI-generated actions from human-approved ones via the `role` and (for AI summary) the service-level `actorType`.

## Allowed and Disallowed UI Controls

### Allowed (Phase 2E)
- Update AI/review packet status (draft-only if `needs_verification`; approve requires human).
- Update referral status through the valid state machine.
- Transition matter status through the ABR FSM (with reason).
- Refresh page after successful mutation.

### Explicitly disallowed (deferred to later phases)
- Public intake UI — Phase 2F.
- AI review packet generation UI — deferred.
- Freeform legal advice generation UI — never.
- Note authoring UI — deferred.
- Assignment UI — deferred.
- Client profile editing UI — deferred.
- Billing actions — deferred.
- Parent/platform admin actions — deferred.

## UI Rule: Buttons Suggest, Server Authorizes

- Buttons show only when server-derived permissions include the required action.
- Buttons show only when the FSM allows the target state (client-side hint).
- Every mutation POST is re-checked server-side. If a stale button is clicked, the server rejects with `400 AI_SUMMARY_TRANSITION_REJECTED` or similar.
- Failed mutations show a plain error message. No client-side state override.

## Rate-Limit / Error Handling

- All routes are covered by the existing `proxy.ts` middleware — rate limiting and (in non-dev) `Idempotency-Key` enforcement.
- Client fetch uses `credentials: 'same-origin'`, `Content-Type: application/json`, and (as of Phase 2E.5) a fresh `Idempotency-Key: <uuid>` from `lib/idempotency.ts:createIdempotencyKey()`. No auth headers.
- Failed mutations show the server error message inline. Successful mutations trigger `router.refresh()` so the server re-derives all state from the event stream.

## Client Idempotency Contract (Phase 2E.5)

Enforced across all CourtLens client-side mutation POSTs:

- Every request MUST include a fresh `Idempotency-Key` header.
- Key is generated per action via `createIdempotencyKey()`; uses `crypto.randomUUID()` when available.
- Keys are unique per action (regression-tested against reuse).
- No static or predictable values.
- This is a **hard precondition** for Phase 2F public intake UI: no new public POST form ships until all CourtLens client POSTs satisfy this contract.

## Known Gaps Before Phase 2F Public Intake UI

1. **Note authoring UI**: reviewers currently cannot add notes through the UI. The server supports note types via `IncidentNoteRecord`.
2. **Assignment UI**: no way to assign a matter to a reviewer. Requires exposing `assignIncident` via a new route or extending an existing one.
3. **Bilingual copy**: reviewer action button labels are hard-coded English. Should migrate to `next-intl` message catalogs before external stakeholder demo.
4. **Optimistic UI**: currently blocks with `useTransition` and `router.refresh()`. Not optimistic. Consider Server Actions if repeated round-trips become a UX concern.
5. ~~**Idempotency headers**~~ — closed in Phase 2E.5. See "Client Idempotency Contract" above.
6. **N+1 event replay** in queue list — unchanged from Phase 2C. Deferred.

## Related

- [Phase 2 tenant matter UI](tenant-matter-ui.md)
- [Phase 2 tenant matter queue API](tenant-matter-queue-api.md)
- [Phase 1 reuse audit](../phase-1/abr-reuse-audit.md)
