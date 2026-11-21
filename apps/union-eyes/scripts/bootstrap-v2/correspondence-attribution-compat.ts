import { compileSecurity } from './security'
import type { V2Plan } from './source'

const literal=(value:string)=>`'${value.replaceAll("'","''")}'`
const columns=['drafted_by','assigned_signer_id','approved_by','signed_by','dispatched_by'] as const

/** Only two correspondence WITH CHECK expressions change. Private profiles,
 * SELECT/USING geometry, role grants, FORCE RLS and all other policies remain
 * intact. Existing FKs still require the referenced profile anchor. */
export function correspondenceAttributionPolicyExpressions(plan:V2Plan) {
  const compiled=compileSecurity(plan)
  const statement=compiled.statements.find(s=>s.startsWith('CREATE POLICY "ue_v2_insert" ON public."correspondence" '))
  const after=statement?.match(/WITH CHECK \(([\s\S]*)\);$/)?.[1]
  const using=compiled.statements.find(s=>s.startsWith('CREATE POLICY "ue_v2_select" ON public."correspondence" '))?.match(/USING \(([\s\S]*)\);$/)?.[1]
  if(!after || !using)throw new Error('CORRESPONDENCE_POLICY_SOURCE_REQUIRED')
  let before=after
  for(const column of columns) {
    const next=`("${column}" IS NULL OR user_management.auth_business_member_parent_authorized("${column}"::text, (nullif(current_setting('app.current_org_id', true), ''))::uuid))`
    if(before.split(next).length!==2)throw new Error(`CORRESPONDENCE_POLICY_SOURCE_DRIFT:${column}`)
    before=before.replace(next,`("${column}" IS NULL OR EXISTS (SELECT 1 FROM public."profiles" v2_fk WHERE v2_fk."user_id" = "correspondence"."${column}"))`)
  }
  return {before,after,using}
}

/** Explicit owner-operated compatibility operation, never application startup.
 * The caller supplies a transaction and bounded lock/statement timeouts and
 * qualifies its exact before/after catalog. PostgreSQL parses both trusted
 * source expressions on a disposable temporary clone for exact comparison. */
export function compileCorrespondenceAttributionUpgradeSql(plan:V2Plan) {
  const {before,after,using}=correspondenceAttributionPolicyExpressions(plan)
  return `DO $ue_correspondence$
DECLARE old_expr text; new_expr text; using_expr text; p record; old_count integer:=0; new_count integer:=0;
BEGIN
  IF NOT EXISTS (SELECT FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner
    WHERE c.oid='public.correspondence'::regclass AND c.relkind='r' AND NOT c.relispartition
      AND c.relrowsecurity AND c.relforcerowsecurity AND r.rolname=current_user)
    THEN RAISE EXCEPTION 'CORRESPONDENCE_UPGRADE_TABLE_OWNER_AND_FORCED_RLS_REQUIRED'; END IF;
  LOCK TABLE public.correspondence IN SHARE ROW EXCLUSIVE MODE;
  IF to_regclass('pg_temp.correspondence') IS NOT NULL THEN RAISE EXCEPTION 'CORRESPONDENCE_UPGRADE_TEMP_CONFLICT'; END IF;
  CREATE TEMP TABLE correspondence (LIKE public.correspondence) ON COMMIT DROP;
  EXECUTE 'CREATE POLICY ue_expected_old ON pg_temp.correspondence FOR INSERT TO union_eyes_runtime WITH CHECK ('||${literal(before)}||')';
  EXECUTE 'CREATE POLICY ue_expected_new ON pg_temp.correspondence FOR UPDATE TO union_eyes_runtime USING ('||${literal(using)}||') WITH CHECK ('||${literal(after)}||')';
  SELECT pg_get_expr(polwithcheck,polrelid) INTO old_expr FROM pg_policy WHERE polrelid='pg_temp.correspondence'::regclass AND polname='ue_expected_old';
  SELECT pg_get_expr(polwithcheck,polrelid),pg_get_expr(polqual,polrelid) INTO new_expr,using_expr FROM pg_policy WHERE polrelid='pg_temp.correspondence'::regclass AND polname='ue_expected_new';
  FOR p IN SELECT polname,polcmd,polpermissive,polroles,pg_get_expr(polwithcheck,polrelid) AS checked,
    pg_get_expr(polqual,polrelid) AS used FROM pg_policy WHERE polrelid='public.correspondence'::regclass
      AND polname IN ('ue_v2_insert','ue_v2_update') LOOP
    IF NOT p.polpermissive OR p.polroles<>ARRAY['union_eyes_runtime'::regrole::oid]
      OR (p.polname='ue_v2_insert' AND (p.polcmd<>'a' OR p.used IS NOT NULL))
      OR (p.polname='ue_v2_update' AND (p.polcmd<>'w' OR p.used IS DISTINCT FROM using_expr))
      THEN RAISE EXCEPTION 'CORRESPONDENCE_UPGRADE_UNRECOGNIZED_POLICY_METADATA'; END IF;
    IF p.checked=old_expr THEN old_count:=old_count+1;
    ELSIF p.checked=new_expr THEN new_count:=new_count+1;
    ELSE RAISE EXCEPTION 'CORRESPONDENCE_UPGRADE_UNRECOGNIZED_CHECK'; END IF;
  END LOOP;
  IF old_count=2 AND new_count=0 THEN
    EXECUTE 'ALTER POLICY ue_v2_insert ON public.correspondence WITH CHECK ('||${literal(after)}||')';
    EXECUTE 'ALTER POLICY ue_v2_update ON public.correspondence WITH CHECK ('||${literal(after)}||')';
  ELSIF old_count<>0 OR new_count<>2 THEN RAISE EXCEPTION 'CORRESPONDENCE_UPGRADE_PARTIAL_OR_MISSING_POLICY'; END IF;
  DROP TABLE pg_temp.correspondence;
END
$ue_correspondence$;`
}
