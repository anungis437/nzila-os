/** Additive protection for nonfinancial peer nominations only. Retained awards
 * and credit history are never upgraded, issued, approved or rewritten. */
import type { PhysicalGuardContract } from './physical-guard-catalog'

export const MAX_PENDING_PEER_NOMINATIONS = 10

export const REWARD_NOMINATION_BODY = `
DECLARE actor text:=nullif(current_setting('app.current_user_id',true),'');
  selected_org text:=nullif(current_setting('app.current_org_id',true),'');
BEGIN
  IF TG_OP<>'INSERT' THEN
    RAISE EXCEPTION 'REWARD_NOMINATION_HISTORY_IMMUTABLE' USING ERRCODE='42501';
  END IF;
  IF actor IS NULL OR NEW.org_id::text IS DISTINCT FROM selected_org
    OR NEW.issuer_user_id IS DISTINCT FROM actor
    OR NEW.recipient_user_id IS NULL OR NEW.recipient_user_id=actor
    OR NEW.status::text IS DISTINCT FROM 'pending'
    OR NEW.approved_by_user_id IS NOT NULL OR NEW.approved_at IS NOT NULL OR NEW.issued_at IS NOT NULL
    OR NEW.metadata_json IS DISTINCT FROM '{"nomination":true}'::jsonb
    OR NEW.reason IS NULL OR length(btrim(NEW.reason)) NOT BETWEEN 1 AND 500
    OR NEW.reason<>btrim(NEW.reason) THEN
    RAISE EXCEPTION 'PENDING_PEER_NOMINATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  -- Share canonical membership/offboarding principal locks; never replace the
  -- original actor, selected organization, or bearer to inspect a recipient.
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.principal:'||person,0))
    FROM (SELECT DISTINCT person FROM unnest(ARRAY[actor,NEW.recipient_user_id]) person ORDER BY person) people;
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.resource:'||NEW.award_type_id::text,0));
  IF user_management.auth_business_org_authorized(NEW.org_id,NULL::text[]) IS NOT TRUE
    OR user_management.auth_business_member_parent_authorized(NEW.recipient_user_id,NEW.org_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'LIVE_CANONICAL_NOMINATION_MEMBERS_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT FROM public.recognition_award_types t
    JOIN public.recognition_programs p ON p.id=t.program_id AND p.org_id=t.org_id
    WHERE t.id=NEW.award_type_id AND t.org_id=NEW.org_id AND t.program_id=NEW.program_id
      AND t.kind::text='peer' AND p.status::text='active') THEN
    RAISE EXCEPTION 'ACTIVE_PEER_NOMINATION_TYPE_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT FROM public.recognition_awards a WHERE a.org_id=NEW.org_id AND a.issuer_user_id=actor
    AND a.recipient_user_id=NEW.recipient_user_id AND a.award_type_id=NEW.award_type_id AND a.status::text='pending')
    OR (SELECT count(*) FROM public.recognition_awards a WHERE a.org_id=NEW.org_id AND a.issuer_user_id=actor
      AND a.status::text='pending')>=${MAX_PENDING_PEER_NOMINATIONS} THEN
    RAISE EXCEPTION 'PENDING_PEER_NOMINATION_LIMIT' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END
`

export const REWARD_NOMINATION_GUARDS: PhysicalGuardContract = {
  source: 'apps/union-eyes/db/auth/reward-nomination-guards.ts',
  references: [],
  tables: ['recognition_awards'],
  exclusiveTriggers: true,
  functions: [
    {
      name: 'ue_reward_guard_nomination',
      body: REWARD_NOMINATION_BODY,
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
      table_name: 'recognition_awards',
      name: 'ue_reward_nomination_guard',
      function_name: 'ue_reward_guard_nomination',
      tgtype: 31,
      tgdeferrable: false,
      tginitdeferred: false,
      args_hex: '',
      definition:
        'CREATE TRIGGER ue_reward_nomination_guard BEFORE INSERT OR DELETE OR UPDATE ON public.recognition_awards FOR EACH ROW EXECUTE FUNCTION public.ue_reward_guard_nomination()',
    },
  ],
}
