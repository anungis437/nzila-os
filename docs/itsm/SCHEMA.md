# ITSM Command Center — Schema Reference

All tables are in the public PostgreSQL schema managed by Drizzle ORM.  
Source: `packages/db/src/schema/itsm.ts`

---

## Enums

### `ticket_type`
`incident` | `service_request` | `change` | `problem` | `question` | `maintenance` | `access` | `security` | `procurement` | `other`

### `ticket_status`
`new` | `triaged` | `assigned` | `in_progress` | `pending_user` | `pending_third_party` | `resolved` | `closed` | `cancelled`

### `priority`
`p1_critical` | `p2_high` | `p3_medium` | `p4_low`

### `change_type`
`standard` | `normal` | `emergency`

### `problem_status`
`open` | `under_investigation` | `root_cause_identified` | `fix_in_progress` | `resolved` | `closed`

### `asset_type`
`server` | `workstation` | `laptop` | `mobile` | `network_device` | `software` | `license` | `database` | `service` | `other`

### `asset_status`
`in_use` | `spare` | `decommissioned` | `maintenance`

### `change_approval_status`
`pending` | `approved` | `rejected` | `withdrawn`

### `kb_status`
`draft` | `review` | `published` | `archived`

---

## Tables

### `itsm_queues`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| org_id | text | NOT NULL — tenant scope |
| name | text | NOT NULL |
| description | text | |
| team_id | text | FK reference to org team |
| sla_profile_id | uuid | FK → itsm_slas |
| is_default | boolean | DEFAULT false |
| working_hours | jsonb | `{ start, end, timezone, days[] }` |
| escalation_path | jsonb | Ordered list of escalation targets |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

### `itsm_slas`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| org_id | text | NOT NULL |
| name | text | Profile name |
| queue_id | uuid | NULL = org-level; set = queue-specific |
| targets | jsonb | `{ p1: {responseMinutes, resolutionMinutes}, p2: ..., p3: ..., p4: ... }` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `itsm_contracts`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| org_id | text | Provider org |
| client_org_id | text | Client org receiving the service |
| name | text | Contract display name |
| sla_id | uuid | FK → itsm_slas |
| start_date | date | |
| end_date | date | |
| value_cents | integer | Contract value in cents |
| currency | text | DEFAULT 'CAD' |
| notes | text | |
| is_active | boolean | DEFAULT true |
| created_at / updated_at | timestamptz | |

### `itsm_tickets`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| org_id | text | NOT NULL |
| ticket_number | text | e.g. `INC-0042`, UNIQUE |
| type | ticket_type | NOT NULL |
| status | ticket_status | DEFAULT 'new' |
| priority | priority | DEFAULT 'p3_medium' |
| subject | text | NOT NULL |
| description | text | |
| queue_id | uuid | FK → itsm_queues |
| contract_id | uuid | FK → itsm_contracts (MSP) |
| assignee_id | text | User ID of assigned agent |
| reporter_id | text | NOT NULL — who raised the ticket |
| asset_ids | text[] | Affected CI IDs |
| sla_response_due | timestamptz | Computed at creation |
| sla_resolution_due | timestamptz | Computed at creation |
| sla_response_met | boolean | |
| sla_resolution_met | boolean | |
| first_responded_at | timestamptz | |
| resolved_at | timestamptz | |
| closed_at | timestamptz | |
| tags | text[] | |
| metadata | jsonb | Arbitrary extension fields |
| created_at / updated_at | timestamptz | |

**Indexes**: `org_id`, `status`, `priority`, `assignee_id`, `queue_id`, `sla_resolution_due`

### `itsm_ticket_events`
Immutable append-only event log.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| ticket_id | uuid | FK → itsm_tickets |
| actor_id | text | NOT NULL — who triggered the event |
| event_type | text | `status_change`, `comment`, `assignment`, `priority_change`, `sla_breach`, `automation_trigger`, `ai_action` |
| payload | jsonb | Event-specific data |
| created_at | timestamptz | DEFAULT now() — immutable |

### `itsm_assets`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| org_id | text | NOT NULL |
| name | text | NOT NULL |
| asset_type | asset_type | |
| status | asset_status | DEFAULT 'in_use' |
| serial_number | text | |
| owner_id | text | Responsible user/team |
| location | text | |
| purchase_date | date | |
| warranty_expires | date | |
| criticality_score | integer | 0–100 |
| attributes | jsonb | Type-specific metadata |
| created_at / updated_at | timestamptz | |

### `itsm_problems`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| org_id | text | NOT NULL |
| title | text | NOT NULL |
| status | problem_status | DEFAULT 'open' |
| priority | priority | |
| linked_ticket_ids | text[] | Related incident ticket IDs |
| root_cause | text | Populated once identified |
| workaround | text | Interim mitigation steps |
| assignee_id | text | |
| resolved_at | timestamptz | |
| created_at / updated_at | timestamptz | |

### `itsm_changes`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| org_id | text | NOT NULL |
| title | text | NOT NULL |
| change_type | change_type | DEFAULT 'normal' |
| status | text | `draft`, `submitted`, `approved`, `in_progress`, `completed`, `cancelled` |
| description | text | |
| risk_level | text | `low`, `medium`, `high` |
| implementation_plan | text | |
| rollback_plan | text | |
| scheduled_start | timestamptz | |
| scheduled_end | timestamptz | |
| actual_start | timestamptz | |
| actual_end | timestamptz | |
| requestor_id | text | NOT NULL |
| platform_change_id | text | Bridge to `@nzila/platform-change-management` |
| linked_ticket_ids | text[] | |
| created_at / updated_at | timestamptz | |

### `itsm_approvals`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| change_id | uuid | FK → itsm_changes |
| approver_id | text | NOT NULL |
| step | integer | Order in approval chain (1-indexed) |
| status | change_approval_status | DEFAULT 'pending' |
| comment | text | |
| decided_at | timestamptz | |
| created_at | timestamptz | |

### `itsm_kb_articles`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| org_id | text | NOT NULL |
| title | text | NOT NULL |
| slug | text | URL-safe identifier |
| category | text | |
| status | kb_status | DEFAULT 'draft' |
| body | text | Markdown content |
| author_id | text | NOT NULL |
| reviewer_id | text | |
| tags | text[] | |
| view_count | integer | DEFAULT 0 |
| helpful_count | integer | DEFAULT 0 |
| published_at | timestamptz | |
| created_at / updated_at | timestamptz | |
