/**
 * db/rls-storage-authority/authority-kernel.ts
 *
 * Authoritative storage for the Institutional Authority Kernel
 * (lib/authority). Created by platform migration 0013, protected by scoped
 * 0020 (FORCE RLS). All relations are direct organization_id uuid NOT NULL.
 *
 * Runtime DML is deliberately minimal and never includes DELETE: authority
 * records are append-only and database triggers refuse DELETE and TRUNCATE.
 * The recording table ue_authority_events is written only by trigger and is
 * SELECT-only for application code in practice; INSERT is granted because the
 * recording trigger runs as the invoking role, and a guard trigger refuses any
 * insert that is not made from inside the recording trigger.
 */
import type { StorageAuthorityEntry } from './types'

const SUPPORT = [
  'lib/authority/store/facts.ts',
  'lib/authority/store/identity.ts',
  'lib/authority/store/resources.ts',
  'lib/authority/store/mutations.ts',
  'lib/authority/store/lifecycle.ts',
  'lib/authority/store/workflow.ts',
  'lib/authority/store/audit.ts',
  'lib/authority/store/idempotency.ts',
  'lib/authority/store/enforce.ts',
  'db/migrations-platform/0013_authority_kernel_storage.sql',
  'db/migrations-cache/0020_authority_kernel_rls_closure.sql',
]

function tenant(
  table: string,
  reason: string,
  privileges: ('SELECT' | 'INSERT' | 'UPDATE')[],
): StorageAuthorityEntry {
  return {
    table,
    classification: 'TENANT_RLS_REQUIRED',
    reason: `Direct organization_id uuid NOT NULL, created by platform migration 0013 and protected by scoped 0020 (FORCE RLS). ${reason} Reached only through lib/authority/store inside runAuthorityTransaction on the tenant runtime identity. No DELETE: authority records are append-only and trigger-guarded. No schema authority.`,
    supportingCapability: SUPPORT,
    requiredRuntimePrivileges: privileges,
    requiredSystemPrivileges: [],
    invocationAuthority: 'TENANT_USER',
    dbExecutionPrincipal: 'TENANT_RUNTIME',
    reviewPriority: 'NONE',
  }
}

const WORKAID_SUPPORT = [
  'lib/authority/store/workaid-disclosure.ts',
  'lib/authority/workaid-disclosure.ts',
  'lib/authority/store/audit.ts',
  'lib/authority/store/enforce.ts',
  'lib/authority/store/counsel.ts',
  'db/migrations-platform/0027_workaid_union_side_disclosure.sql',
  'db/migrations-cache/0026_workaid_union_side_rls_closure.sql',
]

/** Union-side WorkAid consent and disclosure relations: platform 0027, protected by scoped cache 0026. */
function workaidTenant(
  table: string,
  reason: string,
  privileges: ('SELECT' | 'INSERT' | 'UPDATE')[],
): StorageAuthorityEntry {
  return {
    table,
    classification: 'TENANT_RLS_REQUIRED',
    reason: `Direct organization_id uuid NOT NULL, created by platform migration 0027 and protected by scoped 0026 (FORCE RLS). ${reason} Holds references and authorisations only, never counsel content. Reached only through lib/authority/store/workaid-disclosure inside runAuthorityTransaction on the tenant runtime identity. No DELETE: records are append-only and trigger-guarded. No schema authority.`,
    supportingCapability: WORKAID_SUPPORT,
    requiredRuntimePrivileges: privileges,
    requiredSystemPrivileges: [],
    invocationAuthority: 'TENANT_USER',
    dbExecutionPrincipal: 'TENANT_RUNTIME',
    reviewPriority: 'NONE',
  }
}

export const authorityKernelEntries: StorageAuthorityEntry[] = [
  tenant('ue_authority_mandates', 'Supervisory, financial, governance-review, executive-office and emergency mandates. UPDATE is limited by trigger to revocation and suspension; revocation is terminal.', ['SELECT', 'INSERT', 'UPDATE']),
  tenant('ue_authority_resource_relationships', 'Creator, owner, assignee, collaborator and represented-member relationships. UPDATE is limited by trigger to revocation.', ['SELECT', 'INSERT', 'UPDATE']),
  tenant('ue_authority_delegations', 'Term-limited, action-specific executive delegations. UPDATE is limited by trigger to revocation.', ['SELECT', 'INSERT', 'UPDATE']),
  tenant('ue_authority_recusals', 'Recusal declarations. UPDATE is limited by trigger to lifting, by someone other than the recused person.', ['SELECT', 'INSERT', 'UPDATE']),
  tenant('ue_authority_disclosure_consents', 'Member-issued referral consents and counsel-issued disclosure records. UPDATE is limited by trigger to revocation.', ['SELECT', 'INSERT', 'UPDATE']),
  tenant('ue_authority_approval_requests', 'Governance approval requests. Status resolves only as a consequence of a decision row, enforced by trigger.', ['SELECT', 'INSERT', 'UPDATE']),
  tenant('ue_authority_approval_decisions', 'One-person-one-vote approval decisions, validated by trigger under a row lock on the request. Immutable after insert.', ['SELECT', 'INSERT']),
  tenant('ue_authority_events', 'In-transaction record of every authority mutation, written by trigger. Immutable. A deferred constraint trigger refuses commit unless the canonical audit chain names the event.', ['SELECT', 'INSERT']),
  tenant('ue_authority_issuance_rules', 'Versioned, provenance-backed issuance policy. Inactive until activated with a real source instrument and two approvers other than the drafter. UPDATE is limited by trigger to activation and retirement.', ['SELECT', 'INSERT', 'UPDATE']),
  tenant('ue_authority_acceptances', 'Holder acceptance of a mandate or delegation that requires it. Insert-only, one per instrument, holder only.', ['SELECT', 'INSERT']),
  tenant('ue_authority_requests', 'Idempotency records for authority operations. The result may be written once.', ['SELECT', 'INSERT', 'UPDATE']),
  tenant('ue_authority_financial_steps', 'Append-only financial workflow ledger (registered, prepared, approved, executed, reconciled, voided) with trigger-enforced ordering and segregation of duties. Snapshots the amount at registration.', ['SELECT', 'INSERT']),
  tenant('ue_authority_reviews', 'Governance review register: complainant, adverse parties, classification, remediation owner. UPDATE is limited by trigger to status and remediation owner.', ['SELECT', 'INSERT', 'UPDATE']),
  tenant('ue_authority_workaid_matters', 'Union-side WorkAid referral references only; never counsel content. UPDATE is limited by trigger to counsel acceptance and withdrawal.', ['SELECT', 'INSERT', 'UPDATE']),
  tenant('ue_authority_counsel_engagements', 'Institution-recorded appointment of counsel to one matter: capacity, information barrier and term. References only. UPDATE is limited by trigger to revocation.', ['SELECT', 'INSERT', 'UPDATE']),
  tenant('ue_authority_counsel_nonces', 'Durable single-use register of consumed counsel assertion nonces (SHA-256 only). Insert-only; uniqueness is the replay control.', ['SELECT', 'INSERT']),
  workaidTenant('ue_authority_workaid_consent_texts', 'Institution-recorded, versioned member consent wording; the body hash is enforced by CHECK. UPDATE is limited by trigger to retirement.', ['SELECT', 'INSERT', 'UPDATE']),
  workaidTenant('ue_authority_workaid_consent_grants', 'One row per member consent: the acknowledged wording version and hash, the underlying case and the pseudonymous matter reference given to counsel. Insert-only; every UPDATE is refused by trigger.', ['SELECT', 'INSERT']),
  workaidTenant('ue_authority_workaid_document_auths', 'Per-document authorisation by the consenting member, bounded by the consent. UPDATE is limited by trigger to revocation, which is terminal and immediate.', ['SELECT', 'INSERT', 'UPDATE']),
  workaidTenant('ue_authority_workaid_shares', 'What the union has released toward counsel (categories or one authorised document). UPDATE is limited by trigger to invalidation, written in the same transaction as the revocation that causes it.', ['SELECT', 'INSERT', 'UPDATE']),
  workaidTenant('ue_authority_workaid_counsel_access', 'Append-only record of each manifest served to a verified counsel session. Insert-only; every UPDATE is refused by trigger.', ['SELECT', 'INSERT']),
  {
    ...workaidTenant(
      'ue_authority_workaid_consent_text_proposals',
      'A proposed consent text supplied by the institution. UPDATE is limited by trigger to adoption by a different executive or withdrawal by the proposer. Adoption is what inserts a current consent text. No wording is stored by the migration.',
      ['SELECT', 'INSERT', 'UPDATE'],
    ),
    scopeDisposition: 'OTHER_EXPLICITLY_JUSTIFIED' as const,
    reason: 'Direct organization_id uuid NOT NULL, created by unqualified platform migration 0036 and protected by scoped 0028 (FORCE RLS). Not a Drizzle census declaration: the census stays 231 until VS Code regenerates it. A proposal is not current consent wording. Reached only through lib/authority/store/workaid-disclosure inside runAuthorityTransaction on the tenant runtime identity. No DELETE. No schema authority.',
    supportingCapability: [
      ...WORKAID_SUPPORT,
      'db/migrations-platform/0036_workaid_consent_wording_proposals.sql',
      'db/migrations-cache/0028_workaid_consent_wording_proposal_rls.sql',
    ],
  },
]
