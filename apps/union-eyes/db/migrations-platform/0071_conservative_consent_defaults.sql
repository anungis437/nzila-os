-- platform-migration:conservative_consent_defaults: a column default may not assert a consent, an outcome or a privacy-invasive processing that nobody gave, evaluated or approved (UE-CONV-H-008).
-- The Django models say false for each of these six columns and the platform said true, so a row written by Django and a row written by any other writer disagreed about whether a member had consented or a payment had been routed correctly:
--   member_contact_preferences.email_opt_in / phone_opt_in / mail_opt_in   a pre-ticked consent (CASL and PIPEDA need express consent; Quebec Law 25 asks for the highest confidentiality by default)
--   location_tracking_config.location_tracking_enabled                     tracking switched on by omission
--   separated_payment_transactions.separation_enforced / correct_account_used   an outcome asserted for a transaction nobody checked
-- No writer outside Django inserts into the first two tables, and the payment service sets both outcome columns explicitly, so the platform default moves to the value the Django models already write.
-- Rows that exist keep what they hold: a stored consent is never rewritten. A default that is neither the platform's `true` nor absent was set by someone on purpose and is left alone.
DO $defaults$
DECLARE
  r record;
  target regclass;
  current_default text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
    ('public', 'location_tracking_config', 'location_tracking_enabled'),
    ('public', 'member_contact_preferences', 'email_opt_in'),
    ('public', 'member_contact_preferences', 'mail_opt_in'),
    ('public', 'member_contact_preferences', 'phone_opt_in'),
    ('public', 'separated_payment_transactions', 'correct_account_used'),
    ('public', 'separated_payment_transactions', 'separation_enforced')
    ) AS v(schema_name, table_name, column_name)
    ORDER BY schema_name, table_name, column_name
  LOOP
    target := to_regclass(format('%I.%I', r.schema_name, r.table_name));
    IF target IS NULL THEN
      RAISE EXCEPTION 'platform conservative consent defaults fail-closed: %.% does not exist.', r.schema_name, r.table_name;
    END IF;
    SELECT pg_get_expr(d.adbin, d.adrelid) INTO current_default
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.attrelid = target AND a.attname = r.column_name AND a.attnum > 0 AND NOT a.attisdropped;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'platform conservative consent defaults fail-closed: %.%.% does not exist.', r.schema_name, r.table_name, r.column_name;
    END IF;
    IF current_default IS NULL OR current_default = 'true' THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT false', r.schema_name, r.table_name, r.column_name);
    END IF;
  END LOOP;
END
$defaults$;
