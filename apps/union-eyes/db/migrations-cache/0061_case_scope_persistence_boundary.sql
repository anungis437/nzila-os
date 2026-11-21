-- Forward-only prerequisite for the current canonical case-security compiler.
-- Django owns these models. No existing row or institutional scope is inferred.
-- FORCE RLS without an application policy is deliberate: the mandatory current
-- compiler installs live-session policies and physical guards before activation.
DO $case_boundary$
DECLARE table_name text; target regclass; current_default text; item record;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['case_authority_scopes','case_respondents','case_scope_proposals','case_territories'] LOOP
    target := to_regclass(format('public.%I',table_name));
    IF target IS NULL OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid=target
      AND attname='organization_id' AND atttypid='uuid'::regtype AND attnotnull AND NOT attisdropped) THEN
      RAISE EXCEPTION 'Current Django case scope relation required: %',table_name;
    END IF;
    IF EXISTS(SELECT FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner
      WHERE c.oid=target AND r.rolname IN('union_eyes_runtime','union_eyes_system')) THEN
      RAISE EXCEPTION 'Case scope relation must not be application-owned: %',table_name;
    END IF;
    IF EXISTS(SELECT FROM pg_policy WHERE polrelid=target) THEN
      RAISE EXCEPTION 'Existing case scope policy requires exact reconciliation: %',table_name;
    END IF;
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',target);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',target);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC,union_eyes_runtime,union_eyes_system',target);
  END LOOP;
  -- These are the existing model defaults. Only future inserts gain defaults;
  -- historical transaction IDs, timestamps, parties and scope remain untouched.
  FOR item IN SELECT * FROM (VALUES
    ('claim_status_transitions','id','gen_random_uuid()'),
    ('claim_status_transitions','changed_at','now()'),
    ('case_authority_scopes','revision','0'),
    ('case_scope_proposals','respondent_user_ids','ARRAY[]::character varying[]'),
    ('case_respondents','recorded_at','now()')
  ) AS defaults(table_name,column_name,expression) LOOP
    target := to_regclass(format('public.%I',item.table_name));
    IF target IS NULL OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid=target
      AND attname=item.column_name AND NOT attisdropped) THEN
      RAISE EXCEPTION 'Current Django case column required: %.%',item.table_name,item.column_name;
    END IF;
    SELECT pg_get_expr(d.adbin,d.adrelid) INTO current_default FROM pg_attrdef d
      JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
      WHERE d.adrelid=target AND a.attname=item.column_name;
    IF current_default IS NULL THEN
      EXECUTE format('ALTER TABLE %s ALTER COLUMN %I SET DEFAULT %s',target,item.column_name,item.expression);
    ELSIF current_default<>item.expression AND NOT(item.expression='now()' AND current_default='CURRENT_TIMESTAMP') THEN
      RAISE EXCEPTION 'Conflicting case model default requires reconciliation: %.%',item.table_name,item.column_name;
    END IF;
  END LOOP;
END $case_boundary$;
