# Union Eyes Phase 1A — User-Surface Census

**Gate: FAIL / NOT_PROVEN**

Phase 1A is a source-only inventory of user-visible routes, navigation, action
markup, capability candidates, existing capability-registry entries, and
journey-test surfaces. It does not establish runtime reachability, authorization,
business effects, data ownership, or audit coverage. No runtime journeys were
executed, and no Phase 1B work or remediation was performed.

## Scope and baseline

The accepted route counts are carried forward without reopening the route
reconciliation:

| Measure | Accepted count |
|---|---:|
| App Router page files | 343 |
| `app/api` route files | 965 |
| Route handlers outside `app/api` | 2 |
| App Router route files total | 1,310 |
| Generated API registry entries | 964 |
| Valid NextAuth re-export exception | 1 |
| Unexplained route delta | 0 |

The machine-readable evidence is in
[`PHASE_1A_USER_SURFACE_CENSUS.json`](./PHASE_1A_USER_SURFACE_CENSUS.json).
Its `metadata` records the source baseline, accepted counts, and limitations.
It includes all 343 page records and the existing 31 capability-registry
records.

## Findings

### Page audience and authentication

Of 343 page files, 305 have a current source-based disposition and 38 remain
unconfirmed. The inventory records 102 public pages, 203 pages with multiple
authenticated role experiences, 23 orphan candidates, and the remaining
single-role and system-internal candidates individually.

Historical persona labels are not treated as proof on their own. A legacy
persona is confirmed only when corroborated by a current role path allowlist;
marketing route groups and explicitly recognized public/auth route patterns
are classified from their source location/path. Unresolved pages retain their
candidate label and reason in `pageAudienceIndex.unresolvedPages`.

The shared dashboard layout is server-authenticated and supplies organization
and role context. The client-side role path guard and visible navigation are
not a server-authorization inventory; no authorization conclusion is made
from these page records.

### Navigation graph and hidden-route candidates

The source inventory contains 47 desktop sidebar items across five role
experiences and 72 total desktop/mobile edges. Those items resolve to 26
unique page or route-handler source destinations; no broken destination or
role-allowlist mismatch was found in this static comparison.

There are 176 authenticated page routes without a direct desktop sidebar edge.
They are recorded as hidden canonical destination candidates, not asserted to
be inaccessible: contextual links, nested flows, breadcrumbs, and other
discovery paths were not exhaustively traced. Mobile navigation exposes the
first four filtered sidebar entries and a “More” link to settings; it is not a
complete rendering of the desktop sidebar.

### Visible-action markup and capability candidates

The conservative markup scan records 1,099 button/form action candidates from
1,050 app and shared-component TSX files:

| Static markup disposition | Count |
|---|---:|
| Unknown handler semantics | 427 |
| No handler found in scanned opening markup | 373 |
| Intentionally disabled markup | 293 |
| Client-state handler pattern | 6 |

These dispositions describe what the static scan observed, not whether a
control works. In particular, the scan does not follow arbitrary handlers,
server actions, imported callbacks, API authorization, persistence, or
downstream business effects.

The derived-capability index contains 488 grouped label candidates, including
an explicit unknown remainder. None is verified as a distinct business
capability. The label grouping is only a way to retain source evidence and is
not an exhaustive capability universe.

### Existing registry reconciliation

All 31 entries in
[`capability-registry.ts`](../../apps/union-eyes/lib/reality/capability-registry.ts)
are included with their declared state, `ownedBy` paths, and source-file
existence result. Ownership-path and surface categories are candidate-level
classifications only; no title/keyword similarity is counted as a verified
match to a derived capability. The JSON carries each row and its
`disposition`, including the registry-marked-removed record and unresolved
ownership path.

### Source journey-surface coverage

The existing stakeholder E2E source lists five static role sequences:
member (4 steps), staff (5), executive (5), governance (4), and admin (5).
For each step, the JSON records whether a canonical page/handler source and a
desktop sidebar edge were found. “Surface and nav present” does not mean the
step's user action was exercised or verified.

No app-scoped journey-step inventory was found for `LIUNA_CONTINUITY` or
`WORKAID_OPERATING_MODEL` in the sources examined. The E2E journeys were not
run.

## Gate decision

**FAIL / NOT_PROVEN.** Phase 1A does not meet a zero-unknown, fully reconciled
user-surface census: 38 page classifications remain unconfirmed; 427 action
handlers remain semantically unresolved; all derived-capability records are
unverified candidates; capability-registry equivalence is unproven; two named
journey inventories are absent; and contextual/mobile discovery is incomplete.

This decision closes only the Phase 1A source census. It does not change
Phase 0's `PASS`, reopen accepted route counts, authorize remediation, or
advance into Phase 1B.

## Evidence layout

The JSON contains these machine-readable evidence groups:

1. `pageAudienceIndex` — all page records, audiences, authentication hints,
   purpose basis, confidence, and unresolved classifications.
2. `navigationGraph` — desktop/mobile edges, source destinations, allowlist
   comparison, and hidden-route candidates.
3. `actionIndex` — static action-markup candidates, source lines, handler
   signals, and unresolved semantics.
4. `derivedCapabilityIndex` — grouped source-label candidates and explicit
   unknown remainder.
5. `capabilityRegistryReconciliation` — all current registry entries and
   candidate ownership/surface dispositions.
6. `journeySurfaceCoverage` — source-only role journey steps and missing named
   journey inventories.
7. `discoverability` — summary counts for routes without direct navigation and
   shared-component action candidates.
