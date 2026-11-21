/** The canonical audit ledger names its author truthfully: an audit row attributed to a user is written only in that user's own
 * session. public.audit_logs had no binding between its user_id and the transaction's principal, so a tenant transaction could
 * record an audit entry in someone else's name (atomic-audit-fault: forged actor). This guard refuses that at the database.
 *  - A row with no user (user_id NULL) is always admitted: system actors are stored that way, with the actor in details
 *    (lib/audit/atomic-audit.ts), as are session-less platform records.
 *  - In a tenant (runtime) transaction the user must be the session's own (app.current_user_id, bound by the verified business
 *    session); with no session user, no user can be named.
 *  - The system role is the platform principal and carries no session binding; when its transaction does carry a session user, it
 *    is held to the same rule. Its session-less platform records are unchanged.
 * Owner and superuser maintenance follow the trustedOwner convention of the other physical guards. Only INSERT is guarded: the
 * ledger's rows are not updated by an application role. */
import type { PhysicalGuardContract } from './physical-guard-catalog'

const trustedOwner = `current_user='ue_v2_owner' OR EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND rolsuper)`

export const AUDIT_AUTHOR_BODY = `
DECLARE actor text:=NULLIF(current_setting('app.current_user_id',true),'');
BEGIN
  IF ${trustedOwner} THEN RETURN NEW; END IF;
  IF NEW.user_id IS NOT NULL AND (actor IS NOT NULL OR current_user<>'union_eyes_system')
    AND NEW.user_id IS DISTINCT FROM actor THEN
    RAISE EXCEPTION 'AUDIT_AUTHOR_SESSION_REQUIRED' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END
`

export const AUDIT_AUTHOR_GUARDS: PhysicalGuardContract = {
  source: 'apps/union-eyes/db/auth/audit-author-guards.ts',
  references: [],
  tables: ['audit_logs'],
  // Other triggers on the ledger are not this contract's to refuse.
  exclusiveTriggers: false,
  functions: [
    {
      name: 'ue_audit_guard_author',
      body: AUDIT_AUTHOR_BODY,
      returns: 'trigger',
      args: '',
      volatility: 'v',
      language: 'plpgsql',
      path: 'pg_catalog,public',
      callable: false,
    },
  ],
  constraints: [],
  triggers: [
    {
      table_name: 'audit_logs',
      name: 'ue_audit_author_guard',
      function_name: 'ue_audit_guard_author',
      tgtype: 7,
      tgdeferrable: false,
      tginitdeferred: false,
      args_hex: '',
      definition:
        'CREATE TRIGGER ue_audit_author_guard BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.ue_audit_guard_author()',
    },
  ],
}
