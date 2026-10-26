-- PLATFORM_SQL 0030_message_retention_authority_scope
--
-- Reading or recording an organization's conversation-retention period is a
-- governance_review mandate whose powers name read_retention_policy or
-- adopt_retention and whose scope names that organization. 0029 made a
-- conversation recusable and made a legal hold non-delegable. It did not
-- cover this duty.
--
-- Forward-only. The two checks 0029 installed are dropped and re-added with
-- message_retention and the two retention actions included. Existing rows
-- still satisfy the wider checks. No row is rewritten and no grant changes.
-- 0013 and 0029 are left intact. Neither power is conferred by this migration.

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
    'message_retention'
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
    'message:adopt_retention', 'message:read_retention_policy'
  ]::text[]));
