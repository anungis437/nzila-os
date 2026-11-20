-- Forward-only: the database defaults of the Django BaseModel fields on the four case-scope relations.
-- Django owns these models (backend/grievances/models.py, BaseModel: id UUIDField(default=uuid4), created_at auto_now_add,
-- updated_at auto_now). Every other Django relation carries the same three as database defaults (platform 0073/0074, and the
-- canonical V2 source plan's currentModelServerDefaults), so a writer that omits them - a SQL script, the ORM emitting DEFAULT -
-- gets a value instead of a NOT NULL failure. These four were created after those migrations (grievances 0012) and missed them.
-- Only future inserts gain defaults; no existing row, identifier or timestamp is changed. The expressions are exactly what the
-- canonical V2 plan installs (gen_random_uuid(), CURRENT_TIMESTAMP), so the native and V2 catalogs agree.
DO $case_scope_defaults$
DECLARE target regclass; current_default text; item record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('case_authority_scopes','id','gen_random_uuid()'),
    ('case_authority_scopes','created_at','CURRENT_TIMESTAMP'),
    ('case_authority_scopes','updated_at','CURRENT_TIMESTAMP'),
    ('case_scope_proposals','id','gen_random_uuid()'),
    ('case_scope_proposals','created_at','CURRENT_TIMESTAMP'),
    ('case_scope_proposals','updated_at','CURRENT_TIMESTAMP'),
    ('case_respondents','id','gen_random_uuid()'),
    ('case_respondents','created_at','CURRENT_TIMESTAMP'),
    ('case_respondents','updated_at','CURRENT_TIMESTAMP'),
    ('case_territories','id','gen_random_uuid()'),
    ('case_territories','created_at','CURRENT_TIMESTAMP'),
    ('case_territories','updated_at','CURRENT_TIMESTAMP')
  ) AS defaults(table_name,column_name,expression) LOOP
    target := to_regclass(format('public.%I',item.table_name));
    IF target IS NULL OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid=target
      AND attname=item.column_name AND attnotnull AND NOT attisdropped) THEN
      RAISE EXCEPTION 'Current Django case column required: %.%',item.table_name,item.column_name;
    END IF;
    SELECT pg_get_expr(d.adbin,d.adrelid) INTO current_default FROM pg_attrdef d
      JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
      WHERE d.adrelid=target AND a.attname=item.column_name;
    IF current_default IS NULL THEN
      EXECUTE format('ALTER TABLE %s ALTER COLUMN %I SET DEFAULT %s',target,item.column_name,item.expression);
    ELSIF current_default<>item.expression AND NOT(item.expression='CURRENT_TIMESTAMP' AND current_default='now()') THEN
      RAISE EXCEPTION 'Conflicting case model default requires reconciliation: %.%',item.table_name,item.column_name;
    END IF;
  END LOOP;
END $case_scope_defaults$;
