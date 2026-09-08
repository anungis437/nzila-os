# Union Eyes Storage Scope Discriminator Report (round 51)

Generated: 2026-09-08T11:42:52.922Z

Advisory only -- does not rewrite the manifest. See db/rls-storage-authority/*.ts for the authoritative classification of each table.

Total no-org candidates partitioned: 71 (closed this round: 48, exception queue / still NEEDS_REVIEW: 23)

## Partition counts

| Partition | Count |
| --- | --- |
| LATENT_OR_CONTAINED | 45 |
| FINANCE_REFERENCE | 10 |
| TRUE_GLOBAL_REFERENCE | 4 |
| TENANT_SCOPE_MISSING | 4 |
| PLATFORM_SHARED_CONFIGURATION | 2 |
| SYSTEM_INTERNAL | 2 |
| PRIVACY_OR_SOVEREIGNTY_SENSITIVE | 1 |
| UNKNOWN | 1 |
| USER_SCOPE_MISSING | 1 |
| SEPARATE_DATABASE_BOUNDARY | 1 |

## Closed this round

| Table | Partition | Final classification | Evidence |
| --- | --- | --- | --- |
| swiss_cold_storage | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | services/break-glass-service.ts + services/force-majeure-integration.ts both zero production importers (git-grep confirmed); compliance/views.py SwissColdStorageViewSet was IsAuthenticated-only -> DenyAllPermission. |
| break_glass_system | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same break-glass-service.ts cluster as swiss_cold_storage; round 49 only contained the sibling BreakGlassActivationsViewSet, explicitly left this one out of scope. |
| disaster_recovery_drills | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same break-glass-service.ts cluster. |
| emergency_declarations | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same break-glass-service.ts cluster. |
| recovery_time_objectives | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same break-glass-service.ts cluster. |
| fmv_audit_log | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | services/joint-trust-fmv-service.ts zero production importers; billing/views.py FmvAuditLogViewSet -> SharedDenyAllPermission. |
| fmv_benchmarks | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same joint-trust-fmv-service.ts cluster. |
| fmv_policy | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same joint-trust-fmv-service.ts cluster. |
| fmv_violations | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same joint-trust-fmv-service.ts cluster. |
| cpi_adjusted_pricing | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same joint-trust-fmv-service.ts cluster. |
| cpi_data | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same joint-trust-fmv-service.ts cluster (distinct from cost_of_living_data, which is externally-sourced and still open). |
| independent_appraisals | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same joint-trust-fmv-service.ts cluster. |
| procurement_bids | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same joint-trust-fmv-service.ts cluster. |
| procurement_requests | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same joint-trust-fmv-service.ts cluster. |
| strike_fund_payment_audit | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | services/whiplash-prevention-service.ts zero production importers; billing/views.py StrikeFundPaymentAuditViewSet -> SharedDenyAllPermission. |
| stripe_connect_accounts | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Django ViewSet already SharedDenyAllPermission from a prior round; manifest classification had never been updated to match -- fixed this round (no Django edit needed). |
| tax_year_end_processing | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Django ViewSet already SharedDenyAllPermission from a prior round; manifest classification had never been updated to match -- fixed this round (no Django edit needed). |
| cross_border_transactions | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Both lib/services/currency-service.ts and services/currency-enforcement-service.ts zero production importers; billing/views.py CrossBorderTransactionsViewSet -> SharedDenyAllPermission. |
| arms_length_verification | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | services/founder-conflict-service.ts zero production importers; compliance/views.py -> DenyAllPermission. |
| conflict_of_interest_policy | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same founder-conflict-service.ts cluster. |
| data_classification_registry | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | services/employer-non-interference-service.ts zero production importers; compliance/views.py -> DenyAllPermission. |
| union_only_data_tags | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same employer-non-interference-service.ts cluster. |
| certification_compliance_reports | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | services/certification-management-service.ts (+ dead lib/api/*-service-api.ts Django-bridge scaffolding) zero production importers; compliance/views.py -> DenyAllPermission. |
| certification_types | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same certification-management-service.ts cluster; confirmed distinct from the separate staff_certifications (per-member credential assignment) table, untouched. |
| license_renewals | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same certification-management-service.ts cluster. |
| foreign_workers | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | services/lmbp-immigration-service.ts (+ dead Django-bridge) zero production importers; compliance/views.py -> DenyAllPermission. |
| lmbp_compliance_alerts | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same lmbp-immigration-service.ts cluster. |
| lmbp_compliance_reports | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same lmbp-immigration-service.ts cluster. |
| lmbp_letters | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same lmbp-immigration-service.ts cluster. |
| mentorships | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same lmbp-immigration-service.ts cluster. |
| band_council_consent | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | services/indigenous-data-service.ts zero production importers (barrel-exported from lib/services/index.ts but unused); compliance/views.py -> DenyAllPermission. |
| band_councils | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same indigenous-data-service.ts cluster. |
| indigenous_data_sharing_agreements | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same indigenous-data-service.ts cluster. |
| traditional_knowledge_registry | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same indigenous-data-service.ts cluster. |
| knowledge_base_articles | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | lib/services/support-service.ts searchKnowledgeBase/getKBArticleBySlug zero callers, consistent with round 44 finding this same file dead for ticket_comments/ticket_history; core/views.py -> DenyAllPermission. |
| sla_policies | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same support-service.ts cluster (getSLAMetrics). |
| country_address_formats | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | lib/address/address-service.ts zero production importers; auth_core/views.py -> DenyAllPermission. |
| address_validation_cache | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same address-service.ts cluster. |
| clc_bargaining_trends | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | lib/services/external-data/clc-partnership-service.ts zero production importers; billing/views.py -> SharedDenyAllPermission. |
| clc_union_density | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same clc-partnership-service.ts cluster. |
| clc_oauth_tokens | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same clc-partnership-service.ts cluster (also CREDENTIAL_CONFIGURATION-adjacent: stores OAuth tokens -- an extra reason this generated CRUD surface must stay denied). |
| lrb_agreements | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | lib/services/external-data/lrb-unified-service.ts zero production importers; compliance/views.py -> DenyAllPermission. |
| lrb_sync_log | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Same lrb-unified-service.ts cluster. |
| exchange_rates | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | lib/services/currency-service.ts zero production importers; billing/views.py -> SharedDenyAllPermission (distinct from the already-closed currency_exchange_rates). |
| federation_remittances | LATENT_OR_CONTAINED | CONTAINED_NO_AUTHORITY | Confirmed ZERO TypeScript consumer anywhere (round-31 finding only ever documented the Django exposure); unions/views.py -> DenyAllPermission. |
| cba_intel_sources | TRUE_GLOBAL_REFERENCE | GLOBAL_REFERENCE_DATA | CBA_INTELLIGENCE domain root, no org column anywhere in the domain (round-43 root assumption CONFIRMED); mutated by org admin/steward via ordinary org-authenticated routes, same content-integrity risk class as its round-43 descendants; the ingestion-scheduler.ts cron path is unwired (zero callers), not a live SYSTEM_SCHEDULE path. |
| cba_intel_review_decisions | TRUE_GLOBAL_REFERENCE | GLOBAL_REFERENCE_DATA | Same CBA_INTELLIGENCE domain, polymorphic targetType/targetId into the shared dataset, reviewerId is just the acting user not an org scope. |
| feature_flags | PLATFORM_SHARED_CONFIGURATION | GLOBAL_REFERENCE_DATA | No org column at all -- one row per globally-unique flag name. REAL DEFECT FOUND+FIXED: PATCH /api/admin/feature-flags used withAdminAuth (ordinary per-org admin role) to flip a platform-wide kill switch; fixed to withSystemAdminAuth (isSystemAdmin()). |

## Exception queue (still NEEDS_REVIEW)

| Table | Partition | Evidence |
| --- | --- | --- |
| geofences | TENANT_SCOPE_MISSING | services/geofence-privacy-service.ts has REAL production callers (app/api/emergency/{activate,recovery}, app/api/location/{consent,geofence,track}) -- likely per-organization/per-local geofence definitions with no persisted org discriminator; candidate tenant-scope defect, not verified deeply enough this round to disposition safely. |
| location_deletion_log | SYSTEM_INTERNAL | Same geofence-privacy-service.ts cluster as geofences -- an append-only deletion audit log; likely SYSTEM_INTERNAL but tied to the same unresolved tenant-scope question as its parent. |
| location_tracking_config | TENANT_SCOPE_MISSING | Same geofence-privacy-service.ts cluster -- likely per-org tracking configuration with no persisted org discriminator. |
| privacy_breaches | TENANT_SCOPE_MISSING | services/provincial-privacy-service.ts has REAL production callers (app/api/emergency/{dashboard,pipeda}, app/api/privacy/consent) -- an incident log, likely org-specific, no persisted org discriminator found. |
| provincial_privacy_config | PRIVACY_OR_SOVEREIGNTY_SENSITIVE | Same provincial-privacy-service.ts cluster -- likely genuine province/jurisdiction-level privacy-law reference (PIPEDA vs provincial regimes), a special jurisdictional-governance case per round-51 doctrine section 30, not yet independently verified. |
| arbitrator_profiles | UNKNOWN | lib/services/precedent-service.ts has REAL production callers (app/api/precedents, app/api/precedents/search). Round-51 doctrine section 23 requires field-by-field review (public bio vs private evaluation/rate data may coexist in one row) -- not completed this round. |
| external_data_sync_log | SYSTEM_INTERNAL | lib/services/external-data/wage-enrichment-service.ts has a REAL SYSTEM_SCHEDULE caller (app/api/cron/external-data-sync). Likely a genuine sync audit log, not independently verified/dispositioned this round. |
| contribution_rates | FINANCE_REFERENCE | wage-enrichment-service.ts (cron) + a GraphQL resolver module both real callers -- pension/wage contribution-rate reference data; ejected per round-51 doctrine section 31 (do not broaden into finance convergence). |
| cost_of_living_data | TRUE_GLOBAL_REFERENCE | wage-enrichment-service.ts (cron) real caller -- externally-sourced CPI-adjacent reference data, likely TRUE_GLOBAL_REFERENCE, but effective-dated/lineage review (doctrine sections 19-20) not completed this round. |
| wage_benchmarks | TRUE_GLOBAL_REFERENCE | Same wage-enrichment-service.ts cluster -- externally-sourced benchmark data, lineage review not completed this round. |
| movement_trends | TENANT_SCOPE_MISSING | REAL dashboard page callers (app/[locale]/dashboard/movement-insights/{page,export/page}.tsx) -- likely per-organization movement-analytics insights with no persisted org discriminator; candidate defect, not verified deeply enough to disposition safely. |
| pending_profiles | USER_SCOPE_MISSING | REAL TS callers (actions/pending-profiles-actions.ts, actions/whop-actions.ts, app/api/onboarding, app/api/continuity/inheritance) -- a pre-signup record keyed by email (no user_id yet exists). auth_core/views.py PendingProfilesViewSet is ALSO still IsAuthenticated-only with no scope filter -- a real Django-side exposure alongside the TS path, flagged but not fixed this round pending full TS-route auth verification. |
| user_uuid_mapping | SEPARATE_DATABASE_BOUNDARY | lib/utils/user-uuid-helpers.ts (this app) + services/financial-service/{drizzle,src/db}/schema.ts (a SEPARATE deployable package/database) both reference this table name -- mixed same-name-different-boundary evidence per round-48 precedent; auth_core/views.py UserUuidMappingViewSet ALSO still IsAuthenticated-only, flagged but not fixed this round. |
| data_classification_policy | PLATFORM_SHARED_CONFIGURATION | REAL TS callers (app/api/privacy/{breach,dsar,provincial}) -- likely platform-wide privacy-classification doctrine, not independently verified/dispositioned this round. |
| currency_enforcement_audit | FINANCE_REFERENCE | services/transfer-pricing-service.ts has a REAL production caller (app/api/billing/validate) -- transfer-pricing/tax-compliance audit trail; ejected per round-51 doctrine section 31. |
| fx_rate_audit_log | FINANCE_REFERENCE | Same transfer-pricing-service.ts cluster; ejected per doctrine section 31. |
| t106_filing_tracking | FINANCE_REFERENCE | Same transfer-pricing-service.ts cluster (CRA T106 cross-border filing); ejected per doctrine section 31. |
| bank_of_canada_rates | FINANCE_REFERENCE | Same transfer-pricing-service.ts cluster -- externally-sourced but consumed inside the transfer-pricing tax-compliance engine; ejected per doctrine section 31 rather than split from its consuming domain. |
| currency_enforcement_policy | FINANCE_REFERENCE | Same transfer-pricing-service.ts cluster; ejected per doctrine section 31. |
| currency_enforcement_violations | FINANCE_REFERENCE | Same transfer-pricing-service.ts cluster; ejected per doctrine section 31. |
| transaction_currency_conversions | FINANCE_REFERENCE | Referenced by both the dead lib/services/multi-currency-treasury-service.ts AND the live services/transfer-pricing-service.ts -- the live reference keeps this open; ejected per doctrine section 31. |
| transfer_pricing_documentation | FINANCE_REFERENCE | Same transfer-pricing-service.ts cluster; ejected per doctrine section 31. |
| fee_settlement_batches | FINANCE_REFERENCE | services/platform-economics/transaction-fee-engine.ts. Round 46 ALREADY found and explicitly ejected a PRINCIPAL_MISMATCH defect in this exact module (webhook-invoked code using tenant db instead of withSystemContext), recommending "a dedicated future round auditing services/platform-economics/**" -- round 51 respects that boundary and does not force-close this table. |
