# CUPE RBAC Matrix

> PR-033 · Privileged Action Matrix for Union-Eyes CUPE Pilot

## Roles (ascending privilege)

| Level | Role              | Description                                    |
|-------|-------------------|------------------------------------------------|
| 0     | `member`          | Union member filing or viewing own cases       |
| 1     | `steward`         | Workplace steward handling local-level cases   |
| 2     | `chief_steward`   | Chief steward – escalation & local oversight   |
| 2     | `business_agent`  | Business agent – same privilege as chief       |
| 3     | `officer`         | National/regional officer                      |
| 4     | `admin`           | Union administrator – full case control        |
| 5     | `platform_admin`  | Platform operator (system-level)               |

## Action Matrix

| Action              | member | steward | chief_steward | business_agent | officer | admin | platform_admin |
|---------------------|--------|---------|---------------|----------------|---------|-------|----------------|
| `case_create`       | ✅      | ✅       | ✅             | ✅              | ✅       | ✅     | ✅              |
| `case_read_own`     | ✅      | ✅       | ✅             | ✅              | ✅       | ✅     | ✅              |
| `case_read_any`     | ❌      | ⚠️       | ✅             | ✅              | ✅       | ✅     | ✅              |
| `case_assign`       | ❌      | ❌       | ✅             | ✅              | ✅       | ✅     | ✅              |
| `case_transition`   | ❌      | ✅       | ✅             | ✅              | ✅       | ✅     | ✅              |
| `case_close`        | ❌      | ❌       | ⚠️             | ⚠️              | ✅       | ✅     | ✅              |
| `case_reopen`       | ❌      | ❌       | ❌             | ❌              | ✅       | ✅     | ✅              |
| `case_export`       | ❌      | ❌       | ❌             | ❌              | ✅       | ✅     | ✅              |
| `note_add`          | ✅      | ✅       | ✅             | ✅              | ✅       | ✅     | ✅              |
| `note_add_internal` | ❌      | ✅       | ✅             | ✅              | ✅       | ✅     | ✅              |
| `attachment_upload` | ✅      | ✅       | ✅             | ✅              | ✅       | ✅     | ✅              |
| `attachment_delete` | ❌      | ❌       | ❌             | ❌              | ❌       | ✅     | ✅              |
| `user_manage`       | ❌      | ❌       | ❌             | ❌              | ❌       | ✅     | ✅              |
| `admin_config`      | ❌      | ❌       | ❌             | ❌              | ❌       | ❌     | ✅              |

### Conditional Access (⚠️)

- **`case_read_any`** for `steward`: Only cases within the steward's assigned local/workplace.
- **`case_close`** for `chief_steward` / `business_agent`: Only if case status is `resolved` or `rejected` (cannot close an active investigation).

## Enforcement

Server-side enforcement via `canPerformAction()` in `apps/union-eyes/lib/action-enforcer.ts`.  
All denials are audit-logged with `AuditEventType.AUTH_FAILED` severity HIGH.
