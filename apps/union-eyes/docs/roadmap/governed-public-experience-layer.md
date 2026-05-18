# Governed Public Experience Layer

## Status: Planned — primitives embedded, full build deferred

The `lib/public-experience/` module contains the type and governance
primitives that will underpin Union Eyes' governed public surface layer.
This doc describes the vision, what's already in the repo, and what
remains to be built.

---

## Why this layer exists

Union Eyes currently serves authenticated users in three audience lanes:

- **Member** — self-service portal
- **Staff / Steward** — casework surface
- **Executive / Officer** — leadership and governance dashboard

The public surface layer adds a fourth context: **public-facing union surfaces**
— campaign pages, news, federation microsites — governed by the same
org-scoped runtime that governs the internal platform.

The key design principle is that **public content must inherit union
governance, not bypass it**. Every published surface must carry:

1. an approval chain,
2. an owning org context,
3. a lifecycle status,
4. and an audit trail.

---

## What is already in the repo

### `lib/public-experience/types.ts`

Core type vocabulary:

| Type | Purpose |
|---|---|
| `ExperienceType` | `internal`, `member`, `public`, `campaign`, `federation` |
| `ExperienceVisibility` | `private`, `authenticated`, `public` |
| `GovernanceLevel` | `standard`, `review-required`, `executive-approved` |
| `PublicContentStatus` | `draft`, `review`, `approved`, `published`, `archived` |

### `lib/public-experience/registry.ts`

In-memory surface registry with helpers:

- `registerSurface()` — register a surface at startup or from DB
- `resolveSurface()` — look up by id
- `getSurfacesByType()` — filter by experience type
- `getSurfacesByVisibility()` — filter by visibility
- `getPublishedPublicSurfaces()` — SSG/ISR feed helper

### `lib/public-experience/governance.ts`

Governance enforcement engine:

- `requiredClearanceForVisibility()` — minimum clearance for a visibility level
- `hasSufficientClearance()` — clearance rank comparison
- `evaluateStatusTransition()` — gate publish/promote/archive actions

The transition rules enforce that:

- any transition to `published` on a `public` surface requires
  `executive-approved` clearance,
- `approved` status requires at minimum `review-required`,
- demoting to `draft` is always permitted (safe reset).

---

## What is not yet built

### 1. DB schema

A `public_surfaces` table with columns for all `ExperienceSurface` fields,
plus a `surface_governance_events` audit table tracking every status
transition with actor, timestamp, and reason.

### 2. API routes

```
POST   /api/surfaces            — register/update a surface
GET    /api/surfaces            — list (filtered by type/org)
POST   /api/surfaces/[id]/promote  — status transition (governance-gated)
GET    /api/surfaces/[id]/history  — governance event log
```

### 3. Route-policy integration

`route-policy.ts` should classify surface-mutating routes as
`audience: 'governance'` and emit audit events with:

- `AuditEventType.CONTENT_PUBLISHED` (new event type, to be added)
- `AuditSeverity.MEDIUM` for authenticated surface promotion
- `AuditSeverity.HIGH` for public surface publish

### 4. Federation governance inheritance

National → regional → local override semantics for surface governance levels.
A local union cannot set a looser governance level than its parent federation.
This requires a `federation_surfaces` join table and a governance resolution
algorithm (highest ancestor wins).

### 5. Microsite SSG integration

`getPublishedPublicSurfaces()` is the intended feed for a Next.js static build
that renders union public sites. Full integration requires:

- a `surface` page template,
- a content schema (TipTap or similar),
- an ISR invalidation webhook on surface status change.

### 6. AI content governance

AI-generated or AI-assisted content targeting public surfaces must pass an
additional governance gate:

- explicit human review required before `approved`,
- `GovernanceLevel` cannot be below `review-required` on AI-assisted surfaces,
- audit trail must record AI involvement.

---

## Design principles

1. **Governance before visibility.** A surface cannot be public before it is
   approved. The approval chain is non-bypassable at the API layer.

2. **Org ownership is mandatory.** Every surface has an owning org. Cross-org
   publishing (federation surfaces) requires federation-level clearance.

3. **Audit is fire-and-forget.** Governance events are emitted async and
   non-blocking. A failed audit emission must never block a publish.

4. **Demotion is always safe.** Any surface can be returned to `draft` by
   a `standard` actor. Unpublishing requires `review-required` or above.

5. **Federation inheritance is conservative.** The most restrictive governance
   level in the ancestor chain wins. Local unions cannot weaken national policy.

---

## Integration with route-policy.ts

Once surface routes are added, they should register as:

```ts
withApi(handler, {
  requireAuth: true,
  requireRole: 'officer',
  audience: 'governance',
  rateLimit: RATE_LIMITS.OFFICER_WRITE,
})
```

The `audience: 'governance'` flag triggers post-handler audit propagation
in the route policy engine at `HIGH` severity for public-surface mutations.
