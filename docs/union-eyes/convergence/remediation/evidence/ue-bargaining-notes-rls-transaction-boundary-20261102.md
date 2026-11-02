# UE bargaining-notes tenant transaction boundary — 2026-11-02

## Source finding
At baseline `4528779c36aaff9a2c0cd84dac5d1ed6a15f5a18`, the item GET read `bargaining_notes` through the module-level `db` outside `withRLSContext`, despite advertising `rlsOrgContext: true`. The collection GET used module-level reads for timeline, statistics and session-type summaries and delegated ordinary and tag-filtered listing to a service using the module-level `db`. These paths carried explicit organization and author/confidentiality predicates, but the collection did not establish a tenant transaction itself. RLS and policy enforcement must not rely on a presumed connection context.

## Correction
The item GET now queries using the actual transaction handle supplied by `withRLSContext({ organizationId, userId }, ...)`. The collection GET wraps every data-producing mode in the same authenticated tenant transaction, including delegated service listing (the `db` proxy resolves to the active tenant transaction via AsyncLocalStorage). The existing explicit organization, agreement and confidentiality predicates remain. Writes and author-only update/delete protections were not relaxed.

## Regression evidence authored
- `apps/union-eyes/app/api/__tests__/bargaining-note-item-rls.route.test.ts`: adversarial module-level DB refusal, tenant-scoped transaction invocation, organization/visibility predicates, missing note and invalid identity refusal.
- `apps/union-eyes/app/api/__tests__/cbas-bargaining-notes.route.test.ts`: ordinary and tag-filtered listing require authenticated transaction scope.

## Qualification limits
Source correction and tests authored, **not** proof of execution. The prior exact baseline `4528779c36aaff9a2c0cd84dac5d1ed6a15f5a18` completed seven substantive CI workflows successfully, including full regression, security, native PG15/16 and disposable HTTP/browser. Those baseline results do not qualify this change. Obtain exact-new-HEAD Vitest/contract, PG15/16, HTTP/browser and staging evidence before increasing any verification status. No independent reviewer, owner persona or institutional authority ratification is represented. No defect-completion or CLOSED credit awarded; the frozen 777-defect provenance is unchanged.

## Defect linkage
Cross-cutting tenant transaction enforcement for bargaining-note collection and item routes. Relevant original obligations include `DEF-0B3-BARGAINING-NOTE-ITEM-ROUTE-BYPASSES-CONFIDENTIALITY` and `DEF-0B3-BARGAINING-NOTES-SUMMARY-MODES-IGNORE-CONFIDENTIALITY`; those earlier confidentiality predicates remain but are now executed inside the tenant transaction. This entry is additive and does not claim complete resolution of the underlying institutional confidentiality policy.
