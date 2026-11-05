-- Rollback of platform-migration:conservative_consent_defaults. It sets the six column defaults back to the `true` the platform had before; no row is touched.
DO $rollback$
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
      RAISE EXCEPTION 'platform conservative consent defaults rollback fail-closed: %.% does not exist.', r.schema_name, r.table_name;
    END IF;
    SELECT pg_get_expr(d.adbin, d.adrelid) INTO current_default
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.attrelid = target AND a.attname = r.column_name AND a.attnum > 0 AND NOT a.attisdropped;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'platform conservative consent defaults rollback fail-closed: %.%.% does not exist.', r.schema_name, r.table_name, r.column_name;
    END IF;
    IF current_default IS NULL OR current_default = 'false' THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT true', r.schema_name, r.table_name, r.column_name);
    END IF;
  END LOOP;
END
$rollback$;
