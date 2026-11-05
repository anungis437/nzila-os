-- Rollback of platform-migration:enhanced_rbac_catalog. It refuses while a member still holds a seeded system role, then removes the seeded roles and the triggers and functions that migration created.
--> statement-breakpoint
DO $rollback$
BEGIN
  IF to_regclass('public.member_roles') IS NOT NULL AND EXISTS (SELECT 1 FROM public.member_roles WHERE role_code IN ('admin', 'president', 'vice_president', 'secretary_treasurer', 'chief_steward', 'officer', 'clerk', 'steward', 'bargaining_committee', 'health_safety_rep', 'member')) THEN
    RAISE EXCEPTION 'platform enhanced_rbac_catalog rollback fail-closed: member_roles still holds a seeded system role; end those assignments first.';
  END IF;
  IF to_regclass('public.role_definitions') IS NOT NULL THEN
    DELETE FROM public.role_definitions WHERE is_system_role AND role_code IN ('admin', 'president', 'vice_president', 'secretary_treasurer', 'chief_steward', 'officer', 'clerk', 'steward', 'bargaining_committee', 'health_safety_rep', 'member');
  END IF;
END
$rollback$;
--> statement-breakpoint
DO $rollback$ BEGIN IF to_regclass('public.rbac_audit_log') IS NOT NULL THEN DROP TRIGGER IF EXISTS rbac_audit_log_append_only ON public.rbac_audit_log; END IF; END $rollback$;
--> statement-breakpoint
DO $rollback$ BEGIN IF to_regclass('public.rbac_audit_log') IS NOT NULL THEN DROP TRIGGER IF EXISTS rbac_audit_log_no_truncate ON public.rbac_audit_log; END IF; END $rollback$;
--> statement-breakpoint
DO $rollback$ BEGIN IF to_regclass('public.member_roles') IS NOT NULL THEN DROP TRIGGER IF EXISTS member_roles_member_organization ON public.member_roles; END IF; END $rollback$;
--> statement-breakpoint
DO $rollback$ BEGIN IF to_regclass('public.permission_exceptions') IS NOT NULL THEN DROP TRIGGER IF EXISTS permission_exceptions_member_organization ON public.permission_exceptions; END IF; END $rollback$;
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.rbac_audit_log_append_only();
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.rbac_member_organization_guard();
