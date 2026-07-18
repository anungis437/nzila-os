# CourtLens Tenant Matter UI — Phase 2D

## Status
- Phase 2C: matter queue/detail API implemented.
- Phase 2C.5: auth contract documented.
- Phase 2C.6: session-derived role + membership verification (auth blockers closed).
- Phase 2D: **read-only tenant matter queue and detail pages implemented (this document)**.
- Phase 2E: reviewer mutation controls implemented.
- Phase 2I: **minimal review-packet export controls implemented** on matter detail.

## Routes Added

- `/[locale]/dashboard/courtlens/matters` — read-only tenant matter queue.
- `/[locale]/dashboard/courtlens/matters/[matterId]` — read-only tenant matter detail.

Both routes reuse the existing ABR `[locale]/dashboard` shell, layout, and design tokens.

## API Dependencies

Both pages are Next.js server components. They call the CourtLens service layer directly (`listMatterQueueForOrg`, `getMatterDetail`, `buildMatterDetailView`) rather than round-tripping through the HTTP API — the same convention used by the existing `dashboard/incidents` pages.

This achieves the same trust guarantees as the API routes because:
1. The pages call `verifyAbrOrgMembership` server-side with the same trusted auth chain as the API routes.
2. The pages use `buildMatterDetailView` with the trusted role for redaction — identical to the API detail route.
3. The browser never sees or sends role/org authorization headers.

The HTTP API routes remain the canonical external contract for future non-Next.js consumers.

## Auth / Session Expectations

Auth chain (per page render):

1. `auth()` from `@nzila/platform-auth/entra/server` — extracts `userId` from the platform session.
2. Unauthenticated → `redirect('/sign-in')`.
3. `verifyAbrOrgMembership(userId, orgId)` — resolves and verifies org membership via:
   - session `orgId` match → trusted role from `orgRole`
   - `abr_users` row → trusted role from DB
   - in-memory demo → trusted role from seed
   - dev-only unverified fallback → only when `NODE_ENV !== 'production'` AND `ABR_ALLOW_UNVERIFIED_ORG === 'true'`
4. `hasPermission(role, 'incident.read')` → RBAC gate.
5. `getMatterDetail` + `buildMatterDetailView` — org-scoped read with role-aware redaction.

**The UI does not send `x-abr-role`.** Role is derived server-side inside the page component. This is enforced by construction because the browser never sees an authorization header.

`x-org-id` is not sent by the UI. Active org is selected via `?org=<slug>` query parameter (optional) or defaults to `ABR_DEMO_ORG_ID` for pilot deployments. Membership is verified before any data is loaded.

## Read-Only Boundary

Phase 2D/2I explicitly does **not** include:
- Public intake UI (Phase 2E+).
- AI review packet generation UI (Phase 3+).
- Reviewer approval/rejection controls (Phase 2E).
- Referral action controls (Phase 2E).
- Assignment or transition UI (Phase 2E).
- Any mutation.

Phase 2I adds only a minimal attachment export trigger on the existing detail page:
- JSON export button
- Markdown export button
- informational unavailable/denied state text

Sensitive download trigger behavior:
- Export is user-gesture only (button click).
- No `next/link` prefetch path is used for export requests.
- Page render does not issue background export fetches.
- Export request is initiated from a direct `fetch` call only after explicit user action.

No new workflow page, no PDF generation, no storage pipeline, and no lifecycle mutation is added by this export control.

The queue page displays operational summaries and links to detail. The detail page displays redacted fields exactly as returned by `buildMatterDetailView`. Neither page renders inputs, forms, or mutation buttons.

## Redaction Behavior

Redaction is entirely server-side. The UI simply renders whatever the server sends:

- **`riskFlags`** section renders only when `view.riskFlags !== null`. `executive_viewer` and `auditor` roles get `null` and the section is hidden.
- **`clientProfile`** section renders only when `view.clientProfile !== null`. Same role gating.
- **`clientGoal`/`hearingDate`/`deadlineDate`** rendered only when non-null.
- **`notes`** rendered only when the role-filtered list is non-empty. Filtering happens in `applyIncidentRedaction`.
- **Raw `events`** are **never** exposed via `buildMatterDetailView`. The detail page has no access to `payloadJson`. Test proves the raw payload string never appears in the rendered HTML.
- **`legalBoundaryNotice`** is rendered verbatim as returned by the server.

The UI does not attempt to reconstruct hidden fields, bypass role gating, or infer redacted data from other fields.

## No-Legal-Advice UX Rules

- Every page carries the framing "operational status only. It is not legal advice."
- The AI review packet status label includes "draft — not for external use" for non-approved states.
- The detail page renders the server-provided `legalBoundaryNotice` at the bottom of the matter view.
- Empty state copy reinforces the operational-infrastructure framing without linking to incomplete flows.
- No output claims to give legal conclusions, predict outcomes, or provide advice.
- Export controls include legal-boundary framing and do not claim legal advice, filing completion, or eligibility decision.

## Review-Packet Export UI (Phase 2I)

Detail page includes `ReviewPacketExportControls` with server-derived conditions:

- Rendered only when actor has `export.read` permission.
- Non-externalizable packets show a localized unavailable state.
- Export requests call dedicated endpoint: `GET /api/courtlens/matters/:matterId/review-packet?format=json|markdown&locale=...`.
- UI does not infer authorization or eligibility; API remains authoritative.

Localization:

- EN and FR keys exist under `courtlens.reviewPacketExport`.
- Bilingual parity is enforced by `messages/__tests__/bilingual-parity.test.ts`.

## Rate-Limit / Error Handling

- Unauthenticated → server-side redirect (no error surface to the browser).
- No membership → generic "access to this organisation is not available" message. No org-existence leak.
- No permission → generic "role does not include permission" message.
- Cross-tenant matter lookup → `notFound()` → Next.js 404. No existence leak.

## Known Gaps Before Phase 2E Reviewer Workflow

1. **Assignment control**: no UI to assign matters to reviewers. Currently only visible in the queue if pre-populated.
2. **Status transition control**: no UI to advance ABR incident FSM state. Reviewers cannot progress a matter through `assigned` → `investigating` → `action_planning` etc.
3. **AI packet approval control**: no UI to advance `ai_summary_status` through `needs_verification` → `approved`. This is the core reviewer action — Phase 2E must add it with strict human-only enforcement (already enforced server-side in `updateAiSummaryStatus`).
4. **Referral controls**: no UI to advance `referral_status` (`none` → `suggested` → `approved` → `sent` → `completed`).
5. **Note authoring**: no UI to add reviewer notes.
6. **Bilingual copy**: page strings are hard-coded English. Should migrate to `next-intl` message catalogs before external stakeholder demo.
7. **Loading/error states**: current implementation relies on React Suspense defaults. Consider explicit skeleton/error boundaries for pilot.
8. **N+1 event replay** in queue list — unchanged from Phase 2C. Deferred until proven blocker.

## Related

- [Phase 2 tenant matter queue API](tenant-matter-queue-api.md)
- [Phase 1 reuse audit](../phase-1/abr-reuse-audit.md)
- [Pilot readiness plan](../pilot-readiness-plan.md)
