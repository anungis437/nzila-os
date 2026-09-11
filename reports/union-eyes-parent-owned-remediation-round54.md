# Union Eyes Parent-Owned Authority Remediation Report (round 54)

Generated: 2026-09-08T19:31:00.878Z

Advisory only -- does not rewrite the manifest. See db/rls-storage-authority/*.ts for the authoritative classification of each table.

This report closes 12 of the 14 non-voting PARENT_OWNED NEEDS_REVIEW tables deferred since round 41 (2 carried forward with explicit architecture blockers), plus 2 direct-parent BLOCKER_ROOT_MICRO_COHORT closures. votes/voting_options remain the only intended parent-owned exception lane, frozen for a dedicated future election-integrity round.

Parent-owned NEEDS_REVIEW: 16 (14 active + 2 voting-frozen) -> 4 (2 carried forward + 2 voting-frozen)

## 14-child disposition matrix

| Table | Direct parent | Working lane | Final classification | Invocation | DB principal | Concrete defect fixed | Residual blocker | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| newsletter_list_subscribers | newsletterDistributionLists (CLOSED round 45) | ARCHITECTURAL_REDESIGN | NEEDS_REVIEW | TBD | TBD | (none) | crud-factory itemRoute mismatch: the URL’s [id] segment is the distribution LIST id, but itemRoute treats params.id as a SUBSCRIBER id — GET/PATCH/DELETE can never match a real row (fails closed, not a live vulnerability, but requires a genuine route-shape product decision to fix) | CARRIED_FORWARD |
| document_signers | signatureDocuments (CLOSED round 45, TENANT_RLS_REQUIRED) | RESOLVED_PARENT_READY | PARENT_OWNED_RLS_REQUIRED | TENANT_USER | TENANT_RUNTIME | (none) | (none) | CLOSED |
| ai_safety_filters | chatSessions (CLOSED round 45, TENANT_RLS_REQUIRED) | RESOLVED_PARENT_READY | PARENT_OWNED_RLS_REQUIRED | TENANT_USER | TENANT_RUNTIME | checkContentSafety() inserted flagged-content audit rows without the already-available sessionId, leaving every row untraceable to its tenant/session — fixed to stamp sessionId on every flagged insert | (none) | CLOSED |
| mobile_sync_queue | (none / no security-relevant parent) | CONTAINED_DEAD_CODE | CONTAINED_NO_AUTHORITY | NONE | NONE | (none) | (none) | CLOSED |
| address_change_history | internationalAddresses | CONTAINED_DEAD_CODE | CONTAINED_NO_AUTHORITY | NONE | NONE | (none) | (none) | CLOSED |
| alert_executions | alertRules (CLOSED round 46, TENANT_RLS_REQUIRED, MIXED authority) | RESOLVED_PARENT_READY | PARENT_OWNED_RLS_REQUIRED | MIXED | MIXED | (none) | (none) | CLOSED |
| award_history | awardTemplates (CLOSED this round, BLOCKER_ROOT_MICRO_COHORT) | CONTAINED_DEAD_CODE | CONTAINED_NO_AUTHORITY | NONE | NONE | (none) | (none) | CLOSED |
| clause_library_tags | sharedClauseLibrary (still NEEDS_REVIEW) | UNRESOLVED_DIRECT_PARENT | NEEDS_REVIEW | TBD | TBD | (none) | Direct parent sharedClauseLibrary is a deliberate cross-union sharing feature (sharingLevel + sharedWithOrgIds), not an ordinary tenant boundary — verifying its 6 real routes correctly enforce sharing-level access control is a genuine architecture review, disqualified from the bounded one-hop BLOCKER_ROOT_MICRO_COHORT | CARRIED_FORWARD |
| contract_line_items | commercialContracts (CLOSED this round, BLOCKER_ROOT_MICRO_COHORT) | RESOLVED_PARENT_READY | PARENT_OWNED_RLS_REQUIRED | TENANT_USER | TENANT_RUNTIME | app/api/contracts/[id]/clauses/route.ts passed the URL contract id straight to getContractLineItems(contractId) with zero organization verification — a live cross-org IDOR letting any authenticated member read another organization’s contract pricing/feature/SLA data; fixed to verify contract ownership before returning line items (fail-closed empty array on mismatch) | (none) | CLOSED |
| firewall_access_rules | (none / no security-relevant parent) | CONTAINED_DEAD_CODE | CONTAINED_NO_AUTHORITY | NONE | NONE | (none) | (none) | CLOSED |
| firewall_violations | (none / no security-relevant parent) | CONTAINED_DEAD_CODE | CONTAINED_NO_AUTHORITY | NONE | NONE | (none) | (none) | CLOSED |
| push_deliveries | pushNotifications + pushDevices (both CLOSED round 46, TENANT_RLS_REQUIRED) | CONTAINED_DEAD_CODE | CONTAINED_NO_AUTHORITY | NONE | NONE | (none) | (none) | CLOSED |
| signature_verification | signatureWorkflows + signers (both still NEEDS_REVIEW, moot given dead-code reachability) | CONTAINED_DEAD_CODE | CONTAINED_NO_AUTHORITY | NONE | NONE | (none) | (none) | CLOSED |
| signers | signatureWorkflows (still NEEDS_REVIEW, moot given dead-code reachability) | CONTAINED_DEAD_CODE | CONTAINED_NO_AUTHORITY | NONE | NONE | (none) | (none) | CLOSED |

## Blocker-root micro-cohort (bounded, one-hop)

| Root | Children blocked | Start classification | Authority model | Final classification | Children unlocked |
| --- | --- | --- | --- | --- | --- |
| award_templates | award_history | NEEDS_REVIEW | Nullable/unenforced organizationId; dead TS code (lib/services/rewards/template-service.ts has zero real callers) | CONTAINED_NO_AUTHORITY | 1 |
| commercial_contracts | contract_line_items | NEEDS_REVIEW | organization_id NOT NULL; MIXED tenant/platform-admin invocation across 3 verified real routes | TENANT_RLS_REQUIRED | 1 |

## Voting freeze (must remain PRESERVED)

PRESERVED — votes and voting_options untouched (manifest, runtime, schema, Django, reasoning all unchanged)

## Finance freeze (must remain PRESERVED)

PRESERVED — none of these 10 tables, their manifest classifications, or their runtime principal architecture were touched this round

- contribution_rates
- currency_enforcement_audit
- fx_rate_audit_log
- t106_filing_tracking
- bank_of_canada_rates
- currency_enforcement_policy
- currency_enforcement_violations
- transaction_currency_conversions
- transfer_pricing_documentation
- fee_settlement_batches

## Round-53 residual blockers (unchanged, carried forward)

- ai_budgets: broken historical RLS policy DDL referencing nonexistent auth.user_id() (round-35 finding, not re-litigated)
- reports: ReportExecutor dynamic SQL generation not independently injection-audited
- sso_providers: oidcClientSecret plaintext credential storage (CREDENTIAL_STORAGE_MODEL_UNRESOLVED)
