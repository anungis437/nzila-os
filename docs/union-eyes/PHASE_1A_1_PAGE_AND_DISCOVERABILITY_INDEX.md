# Phase 1A.1 — Page Audience and Discoverability Index

## Gate

**PASS — SOURCE CENSUS ONLY.** Phase 1A.1e closes the source-evidence census: all 177 computed or nonliteral destination candidates have a known exclusive disposition, with zero true unknowns. This is not runtime proof of reachability, authorization, or product readiness. Static evidence establishes an audience and purpose for all 343 page files, and all 780 accepted literal page-link edges resolve to page sources. Authentication expectations or enforcement are not established for 22 page files; organization-context expectations are not established or proven for 21 page files; and three page sources unconditionally call `notFound()`.

The source baseline is commit `1c337567635bb86ea0df7831557d8d2d22df1e6f`. Detailed per-page evidence and source locations are in [the Phase 1A.1 JSON index](./PHASE_1A_1_PAGE_AND_DISCOVERABILITY_INDEX.json). Evidence-only findings are recorded in the [assurance remediation ledger](./ASSURANCE_REMEDIATION_LEDGER.md); no remediation was applied.

## Scope and method

This phase records each page file's source-backed audience, purpose, authentication and organization-context expectations, entry mechanism, observed callers, and disposition. It also indexes desktop role navigation, mobile direct-entry choices, literal page links, redirects, dynamic-route parents/callers, and unexpanded destination expressions.

The inventory uses source inspection only. General array/string `.push()` and `.replace()` calls are not treated as navigation; only identified router transitions, redirects, links, and relevant route-source patterns are included. The root layout is not treated as an authentication boundary. The dashboard and mobile layouts, admin layout, and page-level guards are classified from their actual source. Navigation visibility is not authorization proof.

No product behavior was changed. No action or capability tracing, user-journey execution, runtime authorization/reachability test, remediation, or Phase 1A.2/1B work was performed.

## Page audience and purpose

The index contains **343 page-file records**. Every record has a source-backed audience and purpose; there are **0 unknown audiences** and **0 purposes not established**.

| Audience | Page files |
|---|---:|
| Public | 116 |
| Multi-persona authenticated | 174 |
| Admin | 35 |
| Member | 4 |
| Staff | 5 |
| Executive | 4 |
| System-internal | 5 |
| **Total** | **343** |

Audience labels are classifications of source intent, not assertions that a route is reachable or that a particular permission is enforced. Role-experience allowlists identify intended navigation audiences; they are not server-side authorization evidence.

### Authentication and organization context

| Authentication / enforcement evidence | Page files |
|---|---:|
| Public-entry intent; no page or ancestor auth guard found | 117 |
| Ancestor layout requires authentication | 95 |
| Page-level user or role guard | 107 |
| Page-level auth check with redirect | 2 |
| Auth expectation not established by page or ancestor source | 18 |
| Auth context is read, but page-level enforcement is not established | 4 |
| **Total** | **343** |

| Organization-context evidence | Page files |
|---|---:|
| Not expected for source-backed public entry | 117 |
| Authenticated user and organization context required by ancestor layout | 205 |
| Page references organization context; requirement not proven by this index | 2 |
| Organization-context expectation not established by page or ancestor source | 19 |
| **Total** | **343** |

The unresolved auth/enforcement and organization-context cases are retained as explicit unknowns. They are not converted into claims of public access or protected access. In particular, `proxy.ts` matcher declarations are not treated as page-level enforcement because the inspected source does not establish their use as a guard.

## Navigation and discoverability

### Desktop role navigation

- **47** desktop navigation items and **72** role-specific navigation edges were inventoried.
- **0** destinations were missing from the page-source inventory; **0** role mismatches were found by this static comparison.
- The 72 edges point to **26 unique page destinations**.
- **317** page files have no direct desktop sidebar entry. Of these, **196** are non-public page files and **178** have source-established auth guards.

No direct sidebar entry does not mean that a page is unreachable: it may have contextual links, redirect entry, another navigation surface, or a data-driven caller. Similarly, a page with no resolved static inbound caller is not labeled an orphan based on absence alone.

### Mobile navigation

Five role configurations were examined. They contain **47** canonical role-navigation entries in total: **20** primary bottom-bar entries and **5** “More”/settings entries. **22** entries are not directly in the mobile bottom bar. This records only the direct-bar relationship; it does not assert that those destinations are unreachable elsewhere in the mobile experience.

### Literal links, redirects, and unresolved destinations

- **780** accepted literal page-link edges were inventoried; all **780** resolve to page-source routes under the static route matcher.
- **212** true redirect candidates were classified:
  - 72 page-alias redirects
  - 39 authentication redirects
  - 86 conditional or workflow redirects
  - 15 role-denial redirects
- The filtered extractor separately recorded **177 computed or nonliteral destination candidates**: 163 JSX `href` expressions, 7 dynamic `router.push` targets, 5 dynamic `router.replace` targets, and 2 dynamic redirects. Phase 1A.1b reconciled these same 177 records individually against their source contracts; the denominator and original extractor classifications are preserved in the JSON index.
- Phase 1A.1c reconciled all **177** candidates into mutually exclusive dispositions: **66** source-bounded with no unresolved internal route, **64** unknown because the producer or destination contract remains unproven, **12** broken internal destination candidates, **20** unreferenced-component candidates, **3** test-only candidates, **10** same-page fragment/query-state candidates, and **2** external destinations. The 177 denominator and every candidate's source identity remain unchanged. These are source-evidence dispositions, not runtime reachability or authorization claims.
- The 12 broken destination candidates include nine carried forward from 1A.1b and three additional fixed-route-set findings: the federation dashboard's `/dashboard/remittances` and `/dashboard/calendar` links; the knowledge console's `/dashboard/agreements` and `/dashboard/calendar` links; and pilot-readiness links to `/dashboard/admin/users`, `/employers`, and `/grievances`. Each missing path is recorded against the page-source inventory; no route was added or changed.
- Phase 1A.1d adds a producer/schema trace for each of the **64** candidates previously classified as unknown, while preserving their historical 1A.1c dispositions and the **177** denominator. The trace consolidates them into **41** root contract findings: **10** source-bounded contracts, **39** known unbounded data/prop contracts, **5** configurable origins without an established host allowlist, and **10** producer/route/field-mapping gap findings (the counts are candidate-level and sum to 64). Known unbounded and broken contracts are recorded as findings, not as proof of a legal or safe destination. Missing writers, callers, routes, and schema-to-consumer mappings remain explicit evidence gaps.
- Phase 1A.1e normalizes the exact ten producer-gap candidates (`DYNAMIC-051`, `052`, `053`, `085`, `086`, `087`, `123`, `124`, `125`, `126`) into **1** known broken producer path, **7** known missing API routes, **1** known field-mapping defect, and **1** known unused/orphan consumer. Eight of these candidates also retain a secondary unbounded-data-contract finding. Recalculated over the historical 64, the exclusive counts are **10** source-bounded, **39** unbounded, **5** configurable origins without host allowlisting, **8** broken/missing producers, **1** field-mapping defect, **1** stale/orphan, and **0** true unknown (sum **64**).
- The final exclusive **177**-candidate rollup is **76** source-bounded, **44** unbounded, **21** broken, **21** inactive, **3** test-only, **10** same-page fragment/query-state, **2** external, and **0** true unknown (sum **177**). “Broken” includes the one known field-mapping defect; “inactive” includes the one orphan consumer. The source-census gates `PHASE_1A_1E_GATE` and `PHASE_1A_1_GATE` therefore read **PASS**. `AUTHORIZATION_RUNTIME_PROVEN`, `PRODUCT_RUNTIME_PROVEN`, and `PRODUCT_READY` remain **NO**. Known defects and unbounded URL contracts remain findings, not remediation.
- The structured candidate traces, evidence, classifications, and root findings are in the [Phase 1A.1 JSON index](./PHASE_1A_1_PAGE_AND_DISCOVERABILITY_INDEX.json); the consolidated carry-forwards are in the [assurance remediation ledger](./ASSURANCE_REMEDIATION_LEDGER.md). The compliance cookie-consent candidate remains an unreferenced-component candidate (the separate GDPR banner is imported by the provider); this is not a dead-code deletion decision.
- **145** page files have no resolved static inbound caller. This is a source observation, not proof of an orphan.

Static resolution means a literal destination matched a page-source route; it does not demonstrate that a user can render the destination or pass runtime authorization. Catch-all and parameterized routing, data-derived values, and computed expressions remain limits of this static analysis. Source-bounded route families establish only the finite or parameterized destination contract inspected; they do not establish valid runtime data or successful rendering.

### Dynamic routes and hidden-route candidates

- **42** dynamic page files were identified.
- **27** have a source-backed parent page; **15** do not have a parent page source resolved by this index.
- **11** dynamic page files have no resolved static caller.
- The non-public/no-direct-sidebar and no-caller records remain candidates for further source review, not an automatic orphan verdict.

The 11 no-caller dynamic routes were reconciled separately without changing their baseline static caller counts:

| Route | Phase 1A.1c disposition | Evidence / remaining uncertainty |
|---|---|---|
| `/login/[[...login]]` | `AUTH_PROVIDER_ENTRY_WITH_PARENT_PAGE` | Catch-all renders login and a parent login page exists; direct runtime entry is not proven. |
| `/signup/[[...signup]]` | `AUTH_PROVIDER_ENTRY_WITH_PARENT_PAGE` | Catch-all renders signup and a parent signup page exists; direct runtime entry is not proven. |
| `/dashboard/dues/pay/[transactionId]` | `EMAIL_OR_NOTIFICATION_ENTRY_CONFIRMED` | Dues reminder jobs construct this URL with a transaction ID (`lib/jobs/dues-reminder-scheduler.ts:362`, `:437`, `:530`). The page also creates provider checkout success/cancel URLs; caller count remains zero in the original static census. |
| `/dashboard/dues/receipts/[transactionId]` | `ORPHAN_ROUTE_CANDIDATE` | No UI caller or direct-entry contract was found. Payment history emits an `/api/dues/receipt/...` URL, not this UI route. Candidate status is not proof that no runtime entry exists. |
| `/dashboard/elections/[id]` | `ORPHAN_ROUTE_CANDIDATE` | The elections page's create action targets `/elections/new`; no source-backed detail caller to the indexed `/dashboard/elections/[id]` family was found. |
| `/dashboard/finance/invoices/[id]` | `BROKEN_UNREACHABLE_ROUTE_CANDIDATE` | The parent pushes `/finance/invoices/${inv.id}`; the indexed detail route is `/dashboard/finance/invoices/[id]`. |
| `/dashboard/financial/budgets/[id]` | `COMPUTED_CALLER_CONFIRMED` | `components/financial/BudgetManager.tsx:313` builds the detail path from `budget.id`. The detail client still uses the deprecated API whose registry says the budgets table was never created; baseline literal-caller count remains zero. |
| `/dashboard/member/timeline/[caseId]` | `ORPHAN_ROUTE_CANDIDATE` | No parent/caller was found; the detail source fetches case data and calls `notFound()` when data is absent. |
| `/dashboard/organizing/[campaignId]` | `COMPUTED_CALLER_CONFIRMED` | The organizing console interpolates `campaign.id` into the indexed detail-route family; the original literal-caller count remains zero. |
| `/dashboard/strike-fund/[fundId]` | `COMPUTED_CALLER_CONFIRMED` | The strike-fund console interpolates `fund.id` into the indexed detail-route family; the original literal-caller count remains zero. |
| `/surveys/[surveyId]` | `DOCUMENTED_DIRECT_ENTRY_CONFIRMED` | Page source documents shareable links and fetches by `surveyId`; caller resolution and runtime availability remain unproven. |

The 11 routes retain their original `resolvedCallerCount` values. Phase 1A.1c adds evidence-backed dispositions without redefining the static caller metric; the route dispositions contain no `UNKNOWN_ENTRY`.

Three case-study page sources unconditionally call `notFound()`:

- `/case-studies/[slug]` — `app/(marketing)/case-studies/[slug]/page.tsx`
- `/case-studies` — `app/(marketing)/case-studies/page.tsx`
- `/case-studies` — `app/[locale]/(marketing)/case-studies/page.tsx`

These are recorded as `SOURCE_ROUTE_ALWAYS_NOT_FOUND`; they are not represented as functioning public destinations.

## Disposition summary

| Disposition | Page files |
|---|---:|
| Page alias redirect | 70 |
| Source route always calls `notFound()` | 3 |
| Auth flow | 11 |
| Canonical source page with no static inbound caller | 96 |
| Contextual workflow | 104 |
| Source-backed direct entry with no inbound link | 17 |
| Shared-component or code-reference entry | 16 |
| Primary role navigation | 26 |
| **Total** | **343** |

## Limitations and next gate

This index does not infer access control from visible navigation, imports, comments, route matcher declarations, or a missing static caller. The source-only candidate reconciliation does not prove runtime data values, external destination safety, catch-all behavior, or successful page rendering. No navigation link was changed, and no route behavior was repaired.

The **PASS** gate closes only the source census. Phase 1A.1e resolves the 64 historical unknowns into source-bounded, unbounded, configurable-origin, broken/missing-producer, field-mapping, and inactive/orphan dispositions; it does not establish runtime values, permitted hosts, authorization, or successful endpoint behavior. The original 12 broken-route candidates, the newly recorded producer-path/API-route gaps and field-mapping defect, the orphan component, auth/organization-context expectations, and three `notFound()` source routes remain findings or unproven runtime conditions. No application behavior changed and no remediation was applied. Phase 3 command obligations (canonical reset, database setup, and integration commands) remain out of scope and unchanged. Phase 1A.2 and Phase 1B have not started.
