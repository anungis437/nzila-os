# Phase 0B.1 — Two-Lineage Table Collision Inventory

**Source of truth:** `reports\audits\cupe-national-phase-0\logs\phase-0b-true-lineage-conflicts.log`  
**Total colliding `public.<name>` tables:** 111  
**Platform lineage:** `packages\db\drizzle` (39 SQL files)  
**Django lineage:** `apps\union-eyes\backend` (32 migration files, excl. venv)  

## Classification summary

| Classification | Count |
| --- | --- |
| REQUIRES_DECISION | 100 |
| DJANGO_INTERNAL | 9 |
| SHARED_INTENT | 2 |

**Classification codes.**
- `SHARED_INTENT` — intentionally shared surface (Outcome C contract).
- `DJANGO_INTERNAL` — Django framework/contrib table; owner = Django by definition.
- `INCOMPATIBLE_DUPLICATE` — table exists in both lineages but semantic collision (e.g. platform lineage duplicates a Django-framework-internal table).
- `REQUIRES_DECISION` — duplicate DDL in both lineages; Aubert must declare owner.

## Full inventory

| Table | Classification | Platform sources | Django sources | Notes |
| --- | --- | --- | --- | --- |
| `ab_test_assignments` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `ab_test_events` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `ab_test_variants` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `ab_tests` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `accessibility_audits` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `accessibility_issues` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `accessibility_test_suites` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `accessibility_user_testing` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `address_change_history` | REQUIRES_DECISION | — | auth_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `address_validation_cache` | REQUIRES_DECISION | — | auth_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `ai_budgets` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `ai_rate_limits` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `ai_safety_filters` | REQUIRES_DECISION | — | — | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `ai_usage_metrics` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `analytics_metrics` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `analytics_scheduled_reports` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `arbitration_decisions` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `arbitration_precedents` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `arbitrator_profiles` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `auth_group` | DJANGO_INTERNAL | — | — | Django framework or contrib internal table; owner = Django. |
| `auth_group_permissions` | DJANGO_INTERNAL | — | — | Django framework or contrib internal table; owner = Django. |
| `auth_permission` | DJANGO_INTERNAL | — | — | Django framework or contrib internal table; owner = Django. |
| `auth_user` | DJANGO_INTERNAL | — | — | Django framework or contrib internal table; owner = Django. |
| `auth_user_groups` | DJANGO_INTERNAL | — | — | Django framework or contrib internal table; owner = Django. |
| `auth_user_user_permissions` | DJANGO_INTERNAL | — | — | Django framework or contrib internal table; owner = Django. |
| `bargaining_notes` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `bargaining_proposals` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `bargaining_team_members` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `benchmark_categories` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `benchmark_data` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `benefit_comparisons` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `cba_clauses` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `cba_contacts` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `cba_footnotes` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `cba_version_history` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `chat_messages` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `chat_sessions` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `chatbot_analytics` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `chatbot_suggestions` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `clause_comparisons` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `clause_comparisons_history` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `clause_library_tags` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `collective_agreements` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `commerce_customers` | REQUIRES_DECISION | packages/db/src/schema/commerce.ts | — | Commerce/billing surface; likely platform-owned but must be confirmed. |
| `commerce_orders` | REQUIRES_DECISION | packages/db/src/schema/commerce.ts | — | Commerce/billing surface; likely platform-owned but must be confirmed. |
| `commerce_products` | REQUIRES_DECISION | packages/db/src/schema/commerce.ts | — | Commerce/billing surface; likely platform-owned but must be confirmed. |
| `commerce_purchase_orders` | REQUIRES_DECISION | packages/db/src/schema/commerce.ts | — | Commerce/billing surface; likely platform-owned but must be confirmed. |
| `commerce_suppliers` | REQUIRES_DECISION | packages/db/src/schema/commerce.ts | — | Commerce/billing surface; likely platform-owned but must be confirmed. |
| `communication_analytics` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `comparative_analyses` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `contribution_rates` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `cost_of_living_data` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `country_address_formats` | REQUIRES_DECISION | — | — | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `cross_org_access_log` | REQUIRES_DECISION | — | auth_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `django_admin_log` | DJANGO_INTERNAL | — | — | Django framework or contrib internal table; owner = Django. |
| `django_content_type` | DJANGO_INTERNAL | — | — | Django framework or contrib internal table; owner = Django. |
| `django_migrations` | DJANGO_INTERNAL | — | — | Django framework or contrib internal table; owner = Django. |
| `documents` | REQUIRES_DECISION | drizzle/0000_initial.sql, packages/db/src/schema/operations.ts | content/0001_initial.py | Cross-cutting artifact table; requires explicit boundary declaration. |
| `evidence_packs` | REQUIRES_DECISION | drizzle/0000_initial.sql, packages/db/src/schema/operations.ts | — | Cross-cutting artifact table; requires explicit boundary declaration. |
| `external_data_sync_log` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `feature_flags` | REQUIRES_DECISION | — | auth_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `insight_recommendations` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `international_addresses` | REQUIRES_DECISION | — | auth_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `knowledge_base` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `kpi_configurations` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `member_consents` | REQUIRES_DECISION | — | auth_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `member_contact_preferences` | REQUIRES_DECISION | — | — | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `member_employment_details` | REQUIRES_DECISION | — | — | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `member_history_events` | REQUIRES_DECISION | — | auth_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `mfa_configurations` | REQUIRES_DECISION | — | auth_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `ml_predictions` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `model_metadata` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `negotiation_sessions` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `negotiations` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `oauth_providers` | REQUIRES_DECISION | — | auth_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `organization_benchmark_snapshots` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `organization_members` | REQUIRES_DECISION | — | — | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `organization_relationships` | REQUIRES_DECISION | — | — | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `organization_sharing_grants` | REQUIRES_DECISION | — | auth_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `organization_sharing_settings` | REQUIRES_DECISION | — | auth_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `organization_users` | REQUIRES_DECISION | — | auth_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `organizations` | SHARED_INTENT | — | — | Shared organization contract (Outcome C: platform_tenant_id = organizations.id = orgs.id). |
| `orgs` | SHARED_INTENT | packages/db/src/schema/orgs.ts | — | Shared organization contract (Outcome C: platform_tenant_id = organizations.id = orgs.id). |
| `page_analytics` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `pending_profiles` | REQUIRES_DECISION | — | auth_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `precedent_citations` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `precedent_tags` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `profiles` | REQUIRES_DECISION | — | — | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `report_delivery_history` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `report_executions` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `report_shares` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `report_templates` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `reports` | REQUIRES_DECISION | — | analytics/0001_initial.py | Cross-cutting artifact table; requires explicit boundary declaration. |
| `scheduled_reports` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `scim_configurations` | REQUIRES_DECISION | — | auth_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `scim_events_log` | REQUIRES_DECISION | — | auth_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `shared_clause_library` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `sso_providers` | REQUIRES_DECISION | — | auth_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `sso_sessions` | REQUIRES_DECISION | — | auth_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `stripe_webhook_events` | REQUIRES_DECISION | drizzle/0000_initial.sql, packages/db/src/schema/payments.ts | billing/0001_initial.py | Commerce/billing surface; likely platform-owned but must be confirmed. |
| `tentative_agreements` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `trend_analyses` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `union_density` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `user_engagement_scores` | REQUIRES_DECISION | — | analytics/0001_initial.py | User identity surface; ownership boundary must be declared explicitly. |
| `user_sessions` | REQUIRES_DECISION | — | auth_core/0001_initial.py | User identity surface; ownership boundary must be declared explicitly. |
| `user_uuid_mapping` | REQUIRES_DECISION | — | auth_core/0001_initial.py | User identity surface; ownership boundary must be declared explicitly. |
| `users` | REQUIRES_DECISION | — | auth_core/0001_initial.py | User identity surface; ownership boundary must be declared explicitly. |
| `votes` | REQUIRES_DECISION | drizzle/0000_initial.sql, packages/db/src/schema/governance.ts | unions/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `wage_benchmarks` | REQUIRES_DECISION | — | analytics/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `wage_progressions` | REQUIRES_DECISION | — | bargaining/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |
| `wcag_success_criteria` | REQUIRES_DECISION | — | ai_core/0001_initial.py | Duplicate DDL in both lineages; material compatibility not automatically verifiable. |

## Generation provenance

```json
{
  "collision_log": "reports\\audits\\cupe-national-phase-0\\logs\\phase-0b-true-lineage-conflicts.log",
  "platform_drizzle_files_scanned": 39,
  "django_migration_files_scanned": 32
}
```

> **Note.** The `REQUIRES_DECISION` rows are not automatically classifiable. Column-level material compatibility, foreign-key ownership, runtime reader/writer distribution, and business meaning must be evaluated by Aubert before an architecture decision is made (see `phase-0b-lineage-architecture-decision.md`).
