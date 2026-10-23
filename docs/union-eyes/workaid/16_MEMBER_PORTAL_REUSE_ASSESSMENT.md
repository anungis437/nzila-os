# 16 — Member-portal reuse assessment

Status: **read-only inspection** of the Union Eyes member-portal code at the pinned base `38a824918cf2e7d7cfb7fcb0e796cbde45433be8`. No Union Eyes file was changed, no route was run, and nothing here is runtime evidence. Every "gap" is routed to Codex as information; none is patched here.

Method: static reading of route files, the CRUD factory and one member page; the question asked was "could a WorkAid member journey be built on this without weakening the denials in [14](14_PERSONA_JOURNEY_CONTRACTS.md)?"

## 1. Summary verdict

| Question | Answer at the pinned base |
|---|---|
| Is there a member-facing route that already returns WorkAid-style published status? | No |
| Can a generic member document route safely serve WorkAid restricted documents? | No, not as written (see §2) |
| Can the existing member timeline page show the WorkAid three-state progress? | Not as written: it targets the grievance timeline and likely resolves to `notFound` (see §3) |
| What is reusable? | Presentation components, the `withApi` / `withRLSContext` / case-actor patterns and the next-intl infrastructure, **after** the authorization model is replaced by the WorkAid contracts |
| Does anything here change a verdict? | No: Design, Implementation, Staging, Pilot and Production remain NO |

## 2. Route-by-route

| Route (as read) | What it does | WorkAid use | Gap |
|---|---|---|---|
| `/api/portal/documents`, `/api/portal/documents/upload` | Generic CRUD over `cmsPages` (write role `steward`) | None. It is CMS content, not member documents | Name suggests member documents; it is not. Do not build on it |
| `/api/members/[id]/documents` | Generic CRUD over `documents`: organization-scoped, read role `member`, **no owner column**; `[id]` is the **document** primary key, not a member id | Would show any organization document a `member` role can reach | No subject-member binding, no data class, no restriction hold, no release grant. A member could read another member's document in the same organization if the factory's org scope were the only control. The WorkAid `authorizeDocumentAccess` requires the subject member, class, hold and a live release grant |
| `/api/members/me` | Generic CRUD over the profile table, organization-scoped | Profile only | Not a status view |
| `/api/portal/dues/balance` | Takes `organizationId` from a query parameter or header, filters by user | Pattern only | A client-supplied organization id is a tenant-selection input; the WorkAid contract derives the organization from the principal and ignores any such input |
| `/api/members/merge` | `POST` returns `{ action: 'merge', status: 'accepted' }` and does nothing; `GET` returns `[]` | Duplicate-identity resolution (D-21) | A **200 for an unimplemented capability**, contrary to the Union Eyes rule that `NOT_IMPLEMENTED` must be 501. Flagged to Codex |
| `app/[locale]/dashboard/member/timeline/[caseId]/page.tsx` | Server-fetches `/api/cases/${caseId}/timeline` without forwarding credentials and expects `data.timeline` | Closest existing "member sees progress" page | See §3 |

## 3. The timeline page

- The route it calls returns `{ data: [...] }`, requires the `grievance_case_suite` entitlement, and includes `actor: createdBy`. The page expects `data.timeline`.
- The page's fetch carries no credentials. In a server component that usually means the request is unauthenticated or uses the server's own identity; the page then most likely falls through to `notFound()`.
- Conclusion: **do not advertise a link to this page for WorkAid** until it is confirmed to render for a member, and treat it as unproven rather than broken. If a navigation link to it already exists, that is a pre-existing Union Eyes issue under the "no link to a route that resolves to notFound" rule and belongs to Codex.
- The vocabulary is grievance-specific (`ClaimStatus`: submitted, under_review, assigned, …). WorkAid needs a different set: *submitted document* · *pending WSIB action* · *decision arrived*. Reusing the grievance statuses would let the wrong words reach a member (WA-C-003).
- Exposing `actor` (the creator's identifier) to a member is a disclosure question for any reuse.

## 4. What the WorkAid contracts need that the portal does not provide

1. A **published-status store** with deny-by-default publication, evidence-stage checks and a wording lint (`publication.ts`). The portal has no equivalent.
2. A **subject-member binding** for every member-visible record. The generic CRUD factory has an `ownerColumn` option that could supply it, but it is not set on the documents route.
3. **Per-document release grants** with live checks at read time, and **restriction holds** that no link, search or preview can bypass.
4. **Request-for-information** items addressed separately to the member and the union.
5. **French and English text pairs** with explicit "unreviewed translation" and English-fallback labelling. The messages directory already carries `en`, `en-CA`, `fr`, `fr-CA`, `it`, `pt`, and `memberTimelinePage` exists in all of them; that is infrastructure, not approved WorkAid content.
6. **A 501** for any capability that is not implemented.

## 5. Reuse, concretely

| Reusable | Condition |
|---|---|
| Timeline and explainer components | Only for presentation; feed them from the WorkAid published-status view, not from the grievance timeline route |
| `withApi`, `withRLSContext`, case-actor patterns | Only after the WorkAid authorization model is the first check in the handler |
| `crud-factory` `ownerColumn` and `orgScoped` | Useful for the subject-member binding; must be set explicitly |
| next-intl and message files | Infrastructure only; no WorkAid string is approved |

## 6. Items routed to Codex (information only)

1. `members/merge` returns 200 for a stub.
2. `members/[id]/documents` has no subject binding (the identifier is the document id).
3. Timeline page fetches without credentials and expects a shape the route does not return.
4. The timeline route exposes `actor` to a member.
5. `portal/dues/balance` accepts the organization id from the client.

None of these has a synthetic reproduction in this slice. A reproduction would need to run the application, which this slice must not do. The harness's `platform-repro.test.ts` covers the earlier source-confirmed storage and search items (WA-INT-001–003, WA-R3-006, WA-R3-012, WA-R3-013).

## 7. Not assessed

Download and signed-link routes for member documents; whether the portal's navigation links to the timeline page; accessibility of any page; whether these routes are reachable in staging; their runtime RLS behaviour.
