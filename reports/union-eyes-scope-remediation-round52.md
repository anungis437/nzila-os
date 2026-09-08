# Union Eyes Scope Remediation Report (round 52)

Generated: 2026-09-08T14:41:42.546Z

Advisory only -- does not rewrite the manifest. See db/rls-storage-authority/*.ts for the authoritative classification of each table.

This report remediates the 13 non-finance exceptions left open by the round-51 scope-discriminator report (reports/union-eyes-scope-discriminator-round51.md, a historical artifact NOT modified this round).

Total tables remediated: 13 (all CLOSED)

## Family counts

| Family | Count |
| --- | --- |
| LOCATION_AND_GEOFENCE | 3 |
| PRIVACY_AND_JURISDICTION | 3 |
| EXTERNAL_REFERENCE_AND_SYNC | 3 |
| DIRECTORY_PROFILE | 1 |
| DERIVED_MOVEMENT_INSIGHT | 1 |
| PRE_AUTH_IDENTITY | 1 |
| CROSS_SERVICE_IDENTITY_MAPPING | 1 |

## 13-table disposition matrix

| Table | Round-51 partition | Final scope | Final classification | Django | Concrete defect fixed |
| --- | --- | --- | --- | --- | --- |
| geofences | TENANT_SCOPE_MISSING | TENANT | TENANT_RLS_REQUIRED | GeofencesViewSet was IsAuthenticated-only -> contained DenyAllPermission | POST /api/location/geofence trusted client-supplied body.unionLocalId (cross-tenant geofence creation IDOR); GET checkGeofenceEntry accepted arbitrary userId query param (fabricated attendance); no cross-tenant read guard on entry-check |
| location_deletion_log | SYSTEM_INTERNAL | GLOBAL_REFERENCE | GLOBAL_REFERENCE_DATA | LocationDeletionLogViewSet was IsAuthenticated-only -> contained DenyAllPermission | (none — dead-code/Django-only containment) |
| location_tracking_config | TENANT_SCOPE_MISSING | GLOBAL_REFERENCE | GLOBAL_REFERENCE_DATA | LocationTrackingConfigViewSet was IsAuthenticated-only -> contained DenyAllPermission | (none — dead-code/Django-only containment) |
| privacy_breaches | TENANT_SCOPE_MISSING | CONTAINED | CONTAINED_NO_AUTHORITY | PrivacyBreachesViewSet was IsAuthenticated-only -> contained DenyAllPermission | (none — dead-code/Django-only containment) |
| provincial_privacy_config | PRIVACY_OR_SOVEREIGNTY_SENSITIVE | GLOBAL_REFERENCE | GLOBAL_REFERENCE_DATA | ProvincialPrivacyConfigViewSet was IsAuthenticated-only -> contained DenyAllPermission | (none — dead-code/Django-only containment) |
| data_classification_policy | PLATFORM_SHARED_CONFIGURATION | GLOBAL_REFERENCE | GLOBAL_REFERENCE_DATA | DataClassificationPolicyViewSet was IsAuthenticated-only -> contained DenyAllPermission | app/api/privacy/{breach,dsar,provincial}/route.ts used writeRole:'admin' (ordinary per-org role) to gate platform-wide compliance-doctrine mutation (no organizationId column at all) -> fixed to 'compliance_manager' (platform-elevated role) |
| external_data_sync_log | SYSTEM_INTERNAL | GLOBAL_REFERENCE | GLOBAL_REFERENCE_DATA | ExternalDataSyncLogViewSet was IsAuthenticated-only -> contained DenyAllPermission | (none — dead-code/Django-only containment) |
| cost_of_living_data | TRUE_GLOBAL_REFERENCE | GLOBAL_REFERENCE | GLOBAL_REFERENCE_DATA | CostOfLivingDataViewSet was IsAuthenticated-only -> contained DenyAllPermission | syncCOLAData ran on the plain tenant db despite SYSTEM_SCHEDULE cron invocation (round-46-class principal mismatch) -> wrapped in withSystemContext |
| wage_benchmarks | TRUE_GLOBAL_REFERENCE | GLOBAL_REFERENCE | GLOBAL_REFERENCE_DATA | WageBenchmarksViewSet was IsAuthenticated-only -> contained DenyAllPermission | syncWageData ran on the plain tenant db despite SYSTEM_SCHEDULE cron invocation (round-46-class principal mismatch) -> wrapped in withSystemContext |
| arbitrator_profiles | UNKNOWN | CONTAINED | CONTAINED_NO_AUTHORITY | ArbitratorProfilesViewSet was IsAuthenticated-only -> contained DenyAllPermission | (none — dead-code/Django-only containment) |
| movement_trends | TENANT_SCOPE_MISSING | GLOBAL_REFERENCE | GLOBAL_REFERENCE_DATA | MovementTrendsViewSet allowed full CRUD to any authenticated user of any org with no officer-role gate at all -> contained DenyAllPermission | (none — dead-code/Django-only containment) |
| pending_profiles | USER_SCOPE_MISSING | GLOBAL_REFERENCE | GLOBAL_REFERENCE_DATA | PendingProfilesViewSet was IsAuthenticated-only -> contained DenyAllPermission | app/api/onboarding/route.ts and its alias app/api/continuity/inheritance/route.ts used readRole:'member' (no organizationId column on this pre-signup table) -> any authenticated member of any org could list every pre-signup user's email/Whop-membership/billing data -> fixed to readRole:'support_agent' (platform-elevated) |
| user_uuid_mapping | SEPARATE_DATABASE_BOUNDARY | CONTAINED | CONTAINED_NO_AUTHORITY | UserUuidMappingViewSet allowed full CRUD (incl. UPDATE, an identity-reassignment/account-takeover-equivalent op) to any authenticated user -> contained DenyAllPermission | (none — dead-code/Django-only containment) |

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
