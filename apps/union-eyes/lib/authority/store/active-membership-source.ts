/**
 * The membership fact source the running topology can actually answer.
 *
 * Legacy current-state lineage: the runtime role reads user_management directly (canonicalMembershipSource).
 * Canonical V2 topology: the runtime role holds NO grant on the identity relations, so the same facts come from the reader-owned
 * SECURITY DEFINER function (membershipSourceViaDefiner), which only answers when the caller's live session authorises the
 * organization. Reading the tables directly under V2 fails with "permission denied" and every kernel-decided route returned 500
 * (found by the V2 real-login acceptance: a steward's POST /api/claims).
 */
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import type { MembershipSource } from './facts'
import { canonicalMembershipSource } from './identity'
import { membershipSourceViaDefiner } from './platform-identity'

export const activeMembershipSource: MembershipSource = (exec, organizationId, userIds) =>
  currentStateContextEnabled()
    ? membershipSourceViaDefiner(exec, organizationId, userIds)
    : canonicalMembershipSource(exec, organizationId, userIds)
