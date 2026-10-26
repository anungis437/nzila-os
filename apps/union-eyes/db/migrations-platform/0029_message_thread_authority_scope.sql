-- PLATFORM_SQL 0029_message_thread_authority_scope
--
-- A conversation legal hold is a governance_review mandate whose powers name
-- place_legal_hold or release_legal_hold and whose scope names that conversation.
-- Two 0013 checks made that duty unenforceable in storage:
--
--   ue_authority_recusal_resource_chk omitted message_thread, so a recusal from
--   the conversation could not be recorded and the kernel could not see it.
--   ue_authority_deleg_nondelegable_chk omitted the two hold actions, so a
--   delegation of the duty could be stored even though the decision refuses it.
--
-- Forward-only. Each constraint is dropped and re-added with the wider predicate.
-- Existing rows use the previous resource types and actions, so they still satisfy
-- the new checks. No row is rewritten, no grant changes, and 0013 is left intact.
-- The hold powers are not conferred by this migration. A live adopted issuance
-- rule must name them, and until one does the decision stays a denial.

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
    'message_thread'
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
    'message:place_legal_hold', 'message:release_legal_hold'
  ]::text[]));
