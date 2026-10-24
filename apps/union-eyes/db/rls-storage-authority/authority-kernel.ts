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
  'lib/authority/store/mutations.ts',
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

export const authorityKernelEntries: StorageAuthorityEntry[] = [
  tenant('ue_authority_mandates', 'Supervisory, financial, governance-review, executive-office and emergency mandates. UPDATE is limited by trigger to revocation and suspension; revocation is terminal.', ['SELECT', 'INSERT', 'UPDATE']),
  tenant('ue_authority_resource_relationships', 'Creator, owner, assignee, collaborator and represented-member relationships. UPDATE is limited by trigger to revocation.', ['SELECT', 'INSERT', 'UPDATE']),
  tenant('ue_authority_delegations', 'Term-limited, action-specific executive delegations. UPDATE is limited by trigger to revocation.', ['SELECT', 'INSERT', 'UPDATE']),
  tenant('ue_authority_recusals', 'Recusal declarations. UPDATE is limited by trigger to lifting, by someone other than the recused person.', ['SELECT', 'INSERT', 'UPDATE']),
  tenant('ue_authority_disclosure_consents', 'Member-issued referral consents and counsel-issued disclosure records. UPDATE is limited by trigger to revocation.', ['SELECT', 'INSERT', 'UPDATE']),
  tenant('ue_authority_approval_requests', 'Governance approval requests. Status resolves only as a consequence of a decision row, enforced by trigger.', ['SELECT', 'INSERT', 'UPDATE']),
  tenant('ue_authority_approval_decisions', 'One-person-one-vote approval decisions, validated by trigger under a row lock on the request. Immutable after insert.', ['SELECT', 'INSERT']),
  tenant('ue_authority_events', 'In-transaction record of every authority mutation, written by trigger. Immutable.', ['SELECT', 'INSERT']),
]
