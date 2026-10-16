# Union Eyes application identity contract

`APPLICATION_USER_ID = TEXT` is a UE-wide semantic contract: any column that stores the authenticated
application user identifier (the `user_management.users.user_id` value carried by the session) is TEXT.
Genuine entity UUID references stay UUID. Classification uses foreign keys, the current declarations
and how live application code reads and writes each column; it is never decided by column name alone.

- Source plan: `4f9732e25ce07fc953648d5275c1901d674c833c78631b814f389bb90cc4c748`
- Identity-looking UUID candidates classified: **77**
- Unclassified current identity columns: **0**
- Contract violations: **0**
- Classification counts: {"APPLICATION_USER_ID":45,"DOMAIN_ENTITY_UUID":18,"DEAD_OR_UNREACHABLE":14}

## APPLICATION_USER_ID (converted to TEXT)

| Column | Type | Basis |
| --- | --- | --- |
| `ai_clause_reasonings.reviewed_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `ai_copilot_sessions.user_id` | uuid -> text | Live application code reads or writes the authenticated application user id into this column. |
| `ai_grievance_triages.reviewed_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `cnesst_filings.created_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `document_access_grants.granted_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `document_access_grants.user_id` | uuid -> text | Live application code reads or writes the authenticated application user id into this column. |
| `dues_transactions.member_id` | uuid -> text | Live application code reads or writes the authenticated application user id into this column. |
| `employer_communications.created_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `employer_communications.sender_user_id` | uuid -> text | Live application code reads or writes the authenticated application user id into this column. |
| `employer_contacts.created_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `external_document_access_grants.granted_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `external_document_access_grants.revoked_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `external_document_access_grants.user_id` | uuid -> text | Live application code reads or writes the authenticated application user id into this column. |
| `external_matter_access_grants.granted_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `external_matter_access_grants.revoked_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `external_matter_access_grants.user_id` | uuid -> text | Live application code reads or writes the authenticated application user id into this column. |
| `grievance_case_access_assignments.granted_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `grievance_case_access_assignments.user_id` | uuid -> text | Live application code reads or writes the authenticated application user id into this column. |
| `grievance_deadlines.confirmed_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `grievance_deadlines.override_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `grievance_deadlines.superseded_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `grievance_events.actor_user_id` | uuid -> text | Live application code reads or writes the authenticated application user id into this column. |
| `grievance_timeline.created_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `grievances.created_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `grievances.last_updated_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `hazard_reports.created_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `hazard_reports.updated_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `org_configurations.updated_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `organization_relationships.created_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `organizations.created_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `payment_plans.user_id` | uuid -> text | Live application code reads or writes the authenticated application user id into this column. |
| `ppe_equipment.created_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `ppe_equipment.updated_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `remittance_line_items.user_id` | uuid -> text | Live application code reads or writes the authenticated application user id into this column. |
| `representation_authorities.created_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `representation_authorities.representative_user_id` | uuid -> text | Live application code reads or writes the authenticated application user id into this column. |
| `representation_authorities.revoked_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `safety_inspections.created_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `safety_inspections.updated_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `safety_training_records.created_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `safety_training_records.updated_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `wcb_claims.created_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `wcb_employer_assessments.created_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `workplace_incidents.created_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |
| `workplace_incidents.updated_by` | uuid -> text | Actor attribution (*_by) stores the acting authenticated application user; there is no foreign key to a uuid entity. |

## DOMAIN_ENTITY_UUID (remain UUID)

| Column | Type | Basis |
| --- | --- | --- |
| `board_packet_distributions.recipient_id` | uuid -> uuid | Live code references the column without the authenticated user id; treated as an entity reference. |
| `collective_agreements.superseded_by` | uuid -> uuid | Identifies the superseding collective agreement (an entity), not a user. |
| `cookie_consents.user_id` | uuid -> uuid | Foreign key to profiles.id (uuid entity key). Non-launch GDPR cookie capability. |
| `dispatch_assignments.member_id` | uuid -> uuid | Live code references the column without the authenticated user id; treated as an entity reference. |
| `employment_history.member_id` | uuid -> uuid | Foreign key to organization_members.id, a uuid entity key; not the authenticated user identifier. |
| `gss_applications.foreign_worker_id` | uuid -> uuid | Live code references the column without the authenticated user id; treated as an entity reference. |
| `lmbp_compliance_alerts.foreign_worker_id` | uuid -> uuid | Live code references the column without the authenticated user id; treated as an entity reference. |
| `member_breaks.member_id` | uuid -> uuid | Foreign key to organization_members.id, a uuid entity key; not the authenticated user identifier. |
| `member_employment.member_id` | uuid -> uuid | Foreign key to organization_members.id, a uuid entity key; not the authenticated user identifier. |
| `member_leaves.member_id` | uuid -> uuid | Foreign key to organization_members.id, a uuid entity key; not the authenticated user identifier. |
| `pension_benefit_claims.member_id` | uuid -> uuid | Live code references the column without the authenticated user id; treated as an entity reference. |
| `pension_contributions.member_id` | uuid -> uuid | Live code references the column without the authenticated user id; treated as an entity reference. |
| `pension_members.user_id` | uuid -> uuid | app/api/pension/members documents that it stores the organization_members.id uuid primary key. |
| `pension_t4a_records.member_id` | uuid -> uuid | Live code references the column without the authenticated user id; treated as an entity reference. |
| `pension_trustees.user_id` | uuid -> uuid | Pension trustee rows reference pension entities by uuid; no application user id is written. |
| `representation_authorities.represented_person_id` | uuid -> uuid | Live code references the column without the authenticated user id; treated as an entity reference. |
| `stewards.user_id` | uuid -> uuid | The steward dashboard documents this uuid as matching organization_members.id (member entity key), not the text application user id. |
| `voter_eligibility.member_id` | uuid -> uuid | Foreign key to organization_members.id, a uuid entity key; not the authenticated user identifier. |

## EXTERNAL_IDENTIFIER

| Column | Type | Basis |
| --- | --- | --- |


## DEAD_OR_UNREACHABLE (no live source reference; no launch mutation)

| Column | Type | Basis |
| --- | --- | --- |
| `cnesst_filings.member_id` | uuid -> uuid | No live (non-test) application source references this column; no launch mutation required. |
| `member_consents.user_id` | uuid -> uuid | No live (non-test) application source references this column; no launch mutation required. |
| `member_contact_preferences.user_id` | uuid -> uuid | No live (non-test) application source references this column; no launch mutation required. |
| `member_employment_details.user_id` | uuid -> uuid | No live (non-test) application source references this column; no launch mutation required. |
| `member_history_events.user_id` | uuid -> uuid | No live (non-test) application source references this column; no launch mutation required. |
| `mfa_configurations.user_id` | uuid -> uuid | No live (non-test) application source references this column; no launch mutation required. |
| `notification_tracking.recipient_id` | uuid -> uuid | No live (non-test) application source references this column; no launch mutation required. |
| `organization_users.organization_user_id` | uuid -> uuid | No live (non-test) application source references this column; no launch mutation required. |
| `organizer_impacts.user_id` | uuid -> uuid | No live (non-test) application source references this column; no launch mutation required. |
| `preventive_withdrawals.member_id` | uuid -> uuid | No live (non-test) application source references this column; no launch mutation required. |
| `right_of_refusal_events.member_id` | uuid -> uuid | No live (non-test) application source references this column; no launch mutation required. |
| `user_management.organization_users.organization_user_id` | uuid -> uuid | No live (non-test) application source references this column; no launch mutation required. |
| `wcb_claims.worker_id` | uuid -> uuid | No live (non-test) application source references this column; no launch mutation required. |
| `workplace_incidents.injured_person_id` | uuid -> uuid | No live (non-test) application source references this column; no launch mutation required. |
