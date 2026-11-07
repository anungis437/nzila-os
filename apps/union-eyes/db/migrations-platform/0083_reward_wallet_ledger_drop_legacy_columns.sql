-- platform-migration:reward_wallet_ledger_drop_legacy_columns: drops six columns left over from a superseded,
-- points-based reward_wallet_ledger shape that bootstrap V2's current declaration
-- (db/schema/domains/infrastructure/rewards.ts) never carried: award_id, description, points_change,
-- reference_id, reference_type, transaction_type. Zero union-eyes-native production code (app/lib/services/
-- actions, excluding tests) reads or writes any of these six columns - every real caller
-- (lib/rewards/page-reads.ts, lib/utils/rewards-stats-utils.ts, lib/services/rewards/notification-service.ts,
-- and the rest) uses only the current twelve-column shape (id, org_id, user_id, event_type, amount_credits,
-- balance_after, source_type, source_id, memo, expires_at, created_at, updated_at). All six columns are
-- nullable, so this is a pure cleanup, not a NOT NULL backfill. Fail-closed on data: if live data still
-- populates any of the six columns anywhere, this migration refuses rather than silently discarding it -
-- that would be a genuine data-loss risk requiring separate investigation, not a mechanical drop.
DO $reward_wallet_ledger_drop_legacy$
DECLARE
  has_data boolean;
BEGIN
  IF to_regclass('public.reward_wallet_ledger') IS NULL THEN
    RAISE EXCEPTION 'platform-migration:reward_wallet_ledger_drop_legacy_columns fail-closed: public.reward_wallet_ledger does not exist.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.reward_wallet_ledger
    WHERE award_id IS NOT NULL
       OR description IS NOT NULL
       OR points_change IS NOT NULL
       OR reference_id IS NOT NULL
       OR reference_type IS NOT NULL
       OR transaction_type IS NOT NULL
  ) INTO has_data;

  IF has_data THEN
    RAISE EXCEPTION 'platform-migration:reward_wallet_ledger_drop_legacy_columns fail-closed: public.reward_wallet_ledger has non-null data in a legacy column; refusing to drop without separate data-disposition review.';
  END IF;

  ALTER TABLE public.reward_wallet_ledger DROP COLUMN IF EXISTS award_id;
  ALTER TABLE public.reward_wallet_ledger DROP COLUMN IF EXISTS description;
  ALTER TABLE public.reward_wallet_ledger DROP COLUMN IF EXISTS points_change;
  ALTER TABLE public.reward_wallet_ledger DROP COLUMN IF EXISTS reference_id;
  ALTER TABLE public.reward_wallet_ledger DROP COLUMN IF EXISTS reference_type;
  ALTER TABLE public.reward_wallet_ledger DROP COLUMN IF EXISTS transaction_type;
END
$reward_wallet_ledger_drop_legacy$;
