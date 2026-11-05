import { describe, expect, it } from 'vitest'
import { compileAuthBootstrapSql } from './auth-storage-authority/bootstrap-sql'
import {
  AUTH_BRIDGE_PROVIDER_NO_PARENT,
  compileAuthOrgBindingSql,
} from './auth-storage-authority/org-session-authority'

describe('invitation revocation and explicit parentless bridges', () => {
  const compiled = compileAuthBootstrapSql()

  it('revokes pending invitations in the same statement that removes inviter authority', () => {
    expect(compiled).toContain('CREATE FUNCTION user_management.auth_revoke_pending_invites(target_user text, target_org uuid)')
    expect(compiled).toContain("pg_advisory_xact_lock(hashtextextended('auth-inviter:' || target_user, 0))")
    expect(compiled).toContain('BEFORE UPDATE OF is_active, lifecycle_state ON user_management.users')
    expect(compiled).toContain('BEFORE UPDATE OF role, is_active ON user_management.organization_users')
    expect(compiled).toContain('GRANT UPDATE (revoked_at) ON user_management.invites')
    expect(compiled).toContain('GRANT EXECUTE ON FUNCTION user_management.auth_revoke_invites_on_user_change() TO "nzila_auth_lifecycle"')
    expect(compiled).toContain('GRANT EXECUTE ON FUNCTION user_management.auth_revoke_invites_on_membership_change() TO "nzila_auth_system_mutation", "nzila_auth_redemption"')
    expect(compiled).not.toContain('GRANT UPDATE (revoked_at) ON user_management.invites TO "nzila_auth_system_mutation"')
    expect(compiled).toContain("OLD.lifecycle_state='active'")
    expect(compiled).toContain("OLD.role='admin' AND OLD.is_active IS TRUE")
  })

  it('does not treat a missing parent session as business authority', () => {
    const binding = compileAuthOrgBindingSql()
    expect(binding).toContain(AUTH_BRIDGE_PROVIDER_NO_PARENT)
    expect(binding).not.toContain("->>'parentSessionId' IS NULL")
    expect(binding).toContain("NULLIF(s.device_info->>'parentSessionId','') IS NOT NULL")
    expect(binding).toContain("s.device_info->>'bridgeClass'='provider-no-parent'")
  })
})
