-- PLATFORM_SQL 0035_election_supersession_authority_scope
-- UNQUALIFIED. Do not apply from Cursor.
--
-- A certified-result supersession is not delegable, and a recusal may name the
-- council election it concerns. This replaces the checks 0030 installed.
-- Existing rows still satisfy the wider checks. No row is rewritten and the
-- power is not conferred. 0013, 0029 and 0030 are left intact.

ALTER TABLE ue_authority_recusals DROP CONSTRAINT IF EXISTS ue_authority_recusal_resource_chk;
--> statement-breakpoint
ALTER TABLE ue_authority_recusals
  ADD CONSTRAINT ue_authority_recusal_resource_chk
  CHECK (resource_type IN (
    'case',
    'financial_transaction',
    'member_financial_record',
    'approval_request',
    'governance_review',
    'workaid_matter',
    'message_thread',
    'message_retention',
    'council_election'
  ));
--> statement-breakpoint
ALTER TABLE ue_authority_delegations DROP CONSTRAINT IF EXISTS ue_authority_deleg_nondelegable_chk;
--> statement-breakpoint
ALTER TABLE ue_authority_delegations
  ADD CONSTRAINT ue_authority_deleg_nondelegable_chk
  CHECK (NOT (actions && ARRAY[
    'finance:view', 'finance:prepare', 'finance:approve', 'finance:execute', 'finance:reconcile', 'finance:audit',
    'case:read_privileged', 'case:disclose_to_member', 'case:export_sealed_evidence', 'case:close', 'review:monitor', 'review:access_evidence', 'review:issue_finding',
    'review:request_corrective_action', 'review:enforce', 'review:verify_remediation',
    'workaid:refer', 'workaid:receive_disclosure', 'workaid:read_counsel_material',
    'message:place_legal_hold', 'message:release_legal_hold',
    'message:adopt_retention', 'message:read_retention_policy',
    'governance:supersede_certified_result'
  ]::text[]));
