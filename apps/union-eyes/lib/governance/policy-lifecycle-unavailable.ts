/**
 * The policy lifecycle governance API (/api/governance/lifecycle/**) is not available: capability UE-GOVERNANCE-POLICY-LIFECYCLE
 * (lib/reality/capability-registry.ts).
 *
 * Its handlers read and wrote governed_policies, policy_approval_chains, policy_approval_actions, policy_conflicts, policy_replay_sessions,
 * policy_governance_events and policy_governance_snapshots through Union Eyes' own database handle. Those seven relations are the Nzila platform's
 * (@nzila/db/schema, reached with platformDb): they exist in no Union Eyes migration, Django model or Drizzle declaration, so every call failed. Had they existed
 * here the handlers ran as the system role, so an administrator of any one organization would have been reading and writing policy for the whole platform, and
 * the audit record sat in a different database from the change it described.
 *
 * What is missing is a decision, not a column: whose policies these are (the platform's, or each organization's), who may approve them and where the record is
 * kept. lib/governance/policy-approval-authority.ts is the pure decision logic written for it (the approver's identity and role come from the session, a body can
 * assert neither); it has no store to run against until that decision is made.
 */
export const POLICY_LIFECYCLE_UNAVAILABLE =
  'Policy lifecycle governance is not available in Union Eyes: the governed-policy store belongs to the Nzila platform database, which Union Eyes does not read, ' +
  'and no organization-scoped policy store has been built. Nothing was read or written.';
