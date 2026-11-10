-- Rollback of platform-migration:reward_wallet_ledger_drop_legacy_columns. Re-adds the six legacy columns as
-- nullable (their original constraint shape before this migration dropped them was already nullable in every
-- environment this programme measured), so this is a safe, reversible structural undo. It cannot restore
-- discarded data - the forward migration refuses to run at all while any such data exists, so there is
-- nothing to restore.
DO $reward_wallet_ledger_drop_legacy_rollback$
BEGIN
  IF to_regclass('public.reward_wallet_ledger') IS NULL THEN
    RAISE EXCEPTION 'platform-migration:reward_wallet_ledger_drop_legacy_columns rollback fail-closed: public.reward_wallet_ledger does not exist.';
  END IF;

  ALTER TABLE public.reward_wallet_ledger ADD COLUMN IF NOT EXISTS award_id uuid;
  ALTER TABLE public.reward_wallet_ledger ADD COLUMN IF NOT EXISTS description text;
  ALTER TABLE public.reward_wallet_ledger ADD COLUMN IF NOT EXISTS points_change integer;
  ALTER TABLE public.reward_wallet_ledger ADD COLUMN IF NOT EXISTS reference_id varchar(255);
  ALTER TABLE public.reward_wallet_ledger ADD COLUMN IF NOT EXISTS reference_type varchar(50);
  ALTER TABLE public.reward_wallet_ledger ADD COLUMN IF NOT EXISTS transaction_type varchar(50);
END
$reward_wallet_ledger_drop_legacy_rollback$;
