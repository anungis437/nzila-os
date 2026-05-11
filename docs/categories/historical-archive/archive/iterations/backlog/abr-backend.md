# ABR Backend — Tracked TODO Backlog

> Generated from TODO-hygiene sweep. Each tracked TODO references an issue marker.

## NZ-301 — Test stub completion (232 occurrences)

All auto-generated Django model test stubs across eight test files contain
`TODO(NZ-301)` markers. Each model has two stub tests:

1. `test_<model>_creation` → `# TODO(NZ-301): Add factory data and assertions`
2. `test_<model>_str` → `# TODO(NZ-301): Create instance and verify str output`

### Affected files

| File | Stub count |
|------|-----------|
| `apps/abr/backend/core/tests.py` | 148 |
| `apps/abr/backend/content/tests.py` | 30 |
| `apps/abr/backend/ai_core/tests.py` | 14 |
| `apps/abr/backend/auth_core/tests.py` | 14 |
| `apps/abr/backend/compliance/tests.py` | 12 |
| `apps/abr/backend/analytics/tests.py` | 6 |
| `apps/abr/backend/billing/tests.py` | 6 |
| `apps/abr/backend/notifications/tests.py` | 2 |

### Resolution path

1. Prioritize tests for governance-critical models (compliance, auth_core).
2. Use `model_bakery` or factories to create valid instances.
3. Assert creation, field defaults, and `__str__` output.

---

## NZ-302 — Service API business logic (26 occurrences)

Auto-generated service view modules in `services/api/` contain stub action methods
with `TODO(NZ-302): Implement business logic`. These endpoints are currently
quarantined behind `ABR_ENABLE_GENERATED_SERVICES` (defaults to `false`).

### Affected files

| File | Stubs |
|------|-------|
| `services/api/live_session_views.py` | 7 |
| `services/api/watch_history_views.py` | 3 |
| `services/api/ai_verification_views.py` | 2 |
| `services/api/embedding_service_views.py` | 2 |
| `services/api/entitlements_views.py` | 2 |
| `services/api/ai_personalization_views.py` | 1 |
| `services/api/codespring_views.py` | 1 |
| `services/api/course_gamification_views.py` | 1 |
| `services/api/courses_enhanced_views.py` | 1 |
| `services/api/evidence_bundles_views.py` | 1 |
| `services/api/gamification_views.py` | 1 |
| `services/api/rbac_views.py` | 1 |
| `services/api/seat_management_views.py` | 1 |
| `services/api/social_views.py` | 1 |
| `services/api/tenant_offboarding_views.py` | 1 |

### Resolution path

1. Prioritize views needed for pilot: case-alerts, evidence-bundles, compliance-reports.
2. Each implementation must route through `governance_bridge` for audit/evidence ops.
3. Remove quarantine flag per-endpoint as logic is validated.
