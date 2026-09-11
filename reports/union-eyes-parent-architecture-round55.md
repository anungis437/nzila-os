# Round 55 — Final Non-Voting Parent Architecture Exceptions

Generated: 2026-09-09T01:50:20.012Z

## Summary

- Starting parent-owned NEEDS_REVIEW: 4
- Active non-voting this round: 2
- Voting frozen (deferred to dedicated round): 2
- Ending parent-owned NEEDS_REVIEW: 2 (votes, voting_options)

## Closed tables

### newsletter_list_subscribers
- Direct parent: newsletter_distribution_lists (CLOSED round 45)
- Authority model: NESTED_COLLECTION_ITEM_AUTHORITY
- Final classification: PARENT_OWNED_RLS_REQUIRED
- Invocation authority: TENANT_USER / DB principal: TENANT_RUNTIME
- Django: Already DenyAllPermission since round 47, reverified unchanged
- Concrete defects fixed:
  - route-shape ID conflation: crud-factory itemRoute treated the URL's [id] (distribution list id) as a subscriber row id — replaced with a bespoke collection route (GET) + new item route (DELETE, soft-unsubscribe) that require BOTH listId and subscriberId to match
  - two frontend callers (distribution-list-manager.tsx, dashboard list-detail page) were unwrapping the withApi response envelope incorrectly and would have silently shown empty subscriber lists even after the backend fix

### shared_clause_library
- Direct parent: (owner root)
- Authority model: OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY
- Final classification: MULTI_PARTY_RLS_REQUIRED
- Invocation authority: TENANT_USER / DB principal: TENANT_RUNTIME
- Django: Contained via DenyAllPermission (was IsAuthenticated-only, queryset=Model.objects.all())
- Concrete defects fixed:
  - list/search returned every clause regardless of organization or sharingLevel (any steward of any org could read any other org's private CBA clause text)
  - POST create trusted body.sourceOrganizationId — any steward could create a clause 'owned' by an arbitrary organization
  - GET/PATCH/DELETE [id] had no ownership or sharing check — any steward could read, edit, or delete any other org's clause
  - [id]/share GET+POST (sharingLevel/sharedWithOrgIds configuration) had no check — any steward could view or change any clause's sharing settings
  - compare/route.ts read full clause text/tags and bumped comparisonCount for every requested id with no authorization check

### clause_library_tags
- Direct parent: shared_clause_library (CLOSED this round)
- Authority model: OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY
- Final classification: MULTI_PARTY_RLS_REQUIRED
- Invocation authority: TENANT_USER / DB principal: TENANT_RUNTIME
- Django: Contained via DenyAllPermission (round-54 entry's claim of 'no ViewSet exists' was incorrect — ClauseLibraryTagsViewSet does exist, corrected this round)
- Concrete defects fixed:
  - tag parent injection: DELETE-by-tagId deleted by tagId alone with no clauseId check — a caller could detach a tag belonging to a DIFFERENT clause (possibly a different organization's) as long as they knew or guessed its id
  - GET/POST/DELETE had zero clause-existence or ownership check at all prior to this round

## Frozen (not touched this round)

- Voting: votes, voting_options
