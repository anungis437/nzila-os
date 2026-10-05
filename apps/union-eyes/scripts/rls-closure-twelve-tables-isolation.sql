-- CHG-2026-0110 cross-tenant isolation proof for the 12 tables (run against a disposable clone; NEVER production).
-- Usage: psql -U postgres -d <clone> -f this-file. It GRANTs to union_eyes_runtime and inserts synthetic rows, so it must only be run on a throwaway database restored from a schema-only dump.
-- Expected output: total=94 passed=94 failed=0.
\set ON_ERROR_STOP on
\set VERBOSITY terse
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_logs, organization_users, compliance_snapshots, domain_events, evidence_packs, integration_idempotency_keys, integration_registry, workbooks, workbook_modules, workbook_purchases, workbook_memory_holders, workbook_governance_lineage_entries TO union_eyes_runtime;

CREATE OR REPLACE FUNCTION pg_temp.ins(p_tbl text, p_over jsonb, p_run bool) RETURNS void AS $$
DECLARE cols text := ''; vals text := ''; r record; v text;
BEGIN
  FOR r IN SELECT a.attname, format_type(a.atttypid,a.atttypmod) typ, a.attnotnull, a.atthasdef, a.attgenerated, a.attidentity
           FROM pg_attribute a WHERE a.attrelid = ('public.'||p_tbl)::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum LOOP
    IF r.attgenerated <> '' THEN CONTINUE; END IF;
    IF p_over ? r.attname THEN v := quote_nullable(p_over->>r.attname);
    ELSIF r.attnotnull AND NOT r.atthasdef AND r.attidentity = '' THEN
      v := CASE
        WHEN r.typ LIKE 'uuid' THEN quote_literal(gen_random_uuid()::text)
        WHEN r.typ LIKE 'character%' OR r.typ = 'text' THEN quote_literal('t'||substr(md5(random()::text),1,6))
        WHEN r.typ LIKE 'timestamp%' THEN 'now()'
        WHEN r.typ = 'date' THEN 'current_date'
        WHEN r.typ LIKE 'bool%' THEN 'false'
        WHEN r.typ LIKE 'json%' THEN quote_literal('{}')
        WHEN r.typ LIKE 'numeric%' OR r.typ IN ('integer','bigint','smallint','double precision','real') THEN (floor(random()*30000))::text
        WHEN r.typ LIKE '%[]' THEN quote_literal('{}')
        ELSE 'NULL' END;
    ELSE CONTINUE; END IF;
    cols := cols || CASE WHEN cols='' THEN '' ELSE ',' END || quote_ident(r.attname);
    vals := vals || CASE WHEN vals='' THEN '' ELSE ',' END || v || CASE WHEN r.typ LIKE 'uuid' THEN '::uuid' ELSE '' END;
  END LOOP;
  EXECUTE format('INSERT INTO public.%I (%s) VALUES (%s)', p_tbl, cols, vals);
END $$ LANGUAGE plpgsql;

-- Setup as superuser (bypasses RLS): one org-A row and one org-B row per direct table, 2 users' workbooks + children.
SET session_replication_role = replica;
CREATE TEMP TABLE res(tbl text, test text, ok bool, detail text);
DO $$
DECLARE a uuid := '00000000-0000-0000-0000-00000000000a'; b uuid := '00000000-0000-0000-0000-00000000000b';
  t text; col text;
BEGIN
  FOR t, col IN SELECT * FROM (VALUES ('audit_logs','organization_id'),('organization_users','organization_id'),('compliance_snapshots','org_id'),('domain_events','org_id'),('evidence_packs','org_id'),('integration_idempotency_keys','org_id'),('integration_registry','org_id')) x LOOP
    PERFORM pg_temp.ins(t, jsonb_build_object(col, a::text), false);
    PERFORM pg_temp.ins(t, jsonb_build_object(col, b::text), false);
  END LOOP;
  PERFORM pg_temp.ins('workbooks', jsonb_build_object('id','00000000-0000-0000-0000-0000000000a1','claimed_by_user_id','userA'), false);
  PERFORM pg_temp.ins('workbooks', jsonb_build_object('id','00000000-0000-0000-0000-0000000000b1','claimed_by_user_id','userB'), false);
  FOREACH t IN ARRAY ARRAY['workbook_modules','workbook_purchases','workbook_memory_holders','workbook_governance_lineage_entries'] LOOP
    PERFORM pg_temp.ins(t, jsonb_build_object('workbook_id','00000000-0000-0000-0000-0000000000a1'), false);
    PERFORM pg_temp.ins(t, jsonb_build_object('workbook_id','00000000-0000-0000-0000-0000000000b1'), false);
  END LOOP;
END $$;
GRANT ALL ON res TO union_eyes_runtime;

-- Tests as the runtime role
SET ROLE union_eyes_runtime;
DO $$
DECLARE a text := '00000000-0000-0000-0000-00000000000a'; b text := '00000000-0000-0000-0000-00000000000b';
  t text; col text; n int; ok bool; i int;
BEGIN
  -- direct tenant tables
  FOR t, col IN SELECT * FROM (VALUES ('audit_logs','organization_id'),('organization_users','organization_id'),('compliance_snapshots','org_id'),('domain_events','org_id'),('evidence_packs','org_id'),('integration_idempotency_keys','org_id'),('integration_registry','org_id')) x LOOP
    PERFORM set_config('app.current_org_id', a, false);
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    INSERT INTO pg_temp.res VALUES (t,'same-org read sees only own', n=1, n::text);
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I::text=%L', t, col, b) INTO n;
    INSERT INTO pg_temp.res VALUES (t,'cross-org read denied', n=0, n::text);
    -- same-org write
    BEGIN PERFORM pg_temp.ins(t, jsonb_build_object(col,a), true); ok := true; EXCEPTION WHEN OTHERS THEN ok := false; END;
    INSERT INTO pg_temp.res VALUES (t,'same-org insert allowed', ok, '');
    -- cross-org insert (context A, row for B) must fail
    BEGIN PERFORM pg_temp.ins(t, jsonb_build_object(col,b), true); ok := false; EXCEPTION WHEN insufficient_privilege THEN ok := true; WHEN OTHERS THEN ok := false; END;
    INSERT INTO pg_temp.res VALUES (t,'cross-org insert denied', ok, '');
    -- cross-org update/delete affect 0 rows
    EXECUTE format('UPDATE public.%I SET %I = %I WHERE %I::text=%L', t, col, col, col, b); GET DIAGNOSTICS n = ROW_COUNT;
    INSERT INTO pg_temp.res VALUES (t,'cross-org update 0 rows', n=0, n::text);
    EXECUTE format('DELETE FROM public.%I WHERE %I::text=%L', t, col, b); GET DIAGNOSTICS n = ROW_COUNT;
    INSERT INTO pg_temp.res VALUES (t,'cross-org delete 0 rows', n=0, n::text);
    -- same-org update/delete work
    EXECUTE format('UPDATE public.%I SET %I = %I WHERE %I::text=%L', t, col, col, col, a); GET DIAGNOSTICS n = ROW_COUNT;
    INSERT INTO pg_temp.res VALUES (t,'same-org update allowed', n>=1, n::text);
    -- missing context
    PERFORM set_config('app.current_org_id', '', false);
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    INSERT INTO pg_temp.res VALUES (t,'missing-org-context read denied', n=0, n::text);
    BEGIN PERFORM pg_temp.ins(t, jsonb_build_object(col,a), true); ok := false; EXCEPTION WHEN insufficient_privilege THEN ok := true; WHEN OTHERS THEN ok := false; END;
    INSERT INTO pg_temp.res VALUES (t,'missing-context insert denied', ok, '');
  END LOOP;
  -- workbooks (user-scoped) and children (parent-owned)
  PERFORM set_config('app.current_user_id','userA',false); PERFORM set_config('app.current_org_id','',false);
  SELECT count(*) INTO n FROM public.workbooks; INSERT INTO pg_temp.res VALUES ('workbooks','same-user read sees only own', n=1, n::text);
  SELECT count(*) INTO n FROM public.workbooks WHERE claimed_by_user_id='userB'; INSERT INTO pg_temp.res VALUES ('workbooks','cross-user read denied', n=0, n::text);
  UPDATE public.workbooks SET claimed_by_user_id='userB' WHERE claimed_by_user_id='userB'; GET DIAGNOSTICS n = ROW_COUNT; INSERT INTO pg_temp.res VALUES ('workbooks','cross-user update 0 rows', n=0, n::text);
  DELETE FROM public.workbooks WHERE claimed_by_user_id='userB'; GET DIAGNOSTICS n = ROW_COUNT; INSERT INTO pg_temp.res VALUES ('workbooks','cross-user delete 0 rows', n=0, n::text);
  BEGIN PERFORM pg_temp.ins('workbooks', jsonb_build_object('claimed_by_user_id','userB'), true); ok := false; EXCEPTION WHEN insufficient_privilege THEN ok := true; WHEN OTHERS THEN ok := false; END;
  INSERT INTO pg_temp.res VALUES ('workbooks','cross-user insert denied', ok, '');
  BEGIN PERFORM pg_temp.ins('workbooks', jsonb_build_object('claimed_by_user_id','userA'), true); ok := true; EXCEPTION WHEN OTHERS THEN ok := false; END;
  INSERT INTO pg_temp.res VALUES ('workbooks','same-user insert allowed', ok, '');
  FOREACH t IN ARRAY ARRAY['workbook_modules','workbook_purchases','workbook_memory_holders','workbook_governance_lineage_entries'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n; INSERT INTO pg_temp.res VALUES (t,'same-parent-owner read sees only own', n=1, n::text);
    EXECUTE format('SELECT count(*) FROM public.%I WHERE workbook_id=%L', t, '00000000-0000-0000-0000-0000000000b1') INTO n; INSERT INTO pg_temp.res VALUES (t,'cross-owner read denied', n=0, n::text);
    EXECUTE format('DELETE FROM public.%I WHERE workbook_id=%L', t, '00000000-0000-0000-0000-0000000000b1'); GET DIAGNOSTICS n = ROW_COUNT; INSERT INTO pg_temp.res VALUES (t,'cross-owner delete 0 rows', n=0, n::text);
    BEGIN PERFORM pg_temp.ins(t, jsonb_build_object('workbook_id','00000000-0000-0000-0000-0000000000b1'), true); ok := false; EXCEPTION WHEN insufficient_privilege THEN ok := true; WHEN OTHERS THEN ok := false; END;
    INSERT INTO pg_temp.res VALUES (t,'cross-owner insert denied', ok, '');
    BEGIN PERFORM pg_temp.ins(t, jsonb_build_object('workbook_id','00000000-0000-0000-0000-0000000000a1'), true); ok := true; EXCEPTION WHEN OTHERS THEN ok := false; END;
    INSERT INTO pg_temp.res VALUES (t,'same-owner insert allowed', ok, '');
    PERFORM set_config('app.current_user_id','',false);
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n; INSERT INTO pg_temp.res VALUES (t,'missing-user-context read denied', n=0, n::text);
    PERFORM set_config('app.current_user_id','userA',false);
  END LOOP;
  PERFORM set_config('app.current_user_id','',false);
  SELECT count(*) INTO n FROM public.workbooks; INSERT INTO pg_temp.res VALUES ('workbooks','missing-user-context read denied', n=0, n::text);
END $$;
RESET ROLE;
SELECT count(*) AS total, count(*) FILTER (WHERE ok) AS passed, count(*) FILTER (WHERE NOT ok) AS failed FROM res;
SELECT tbl, test, detail FROM res WHERE NOT ok ORDER BY 1,2;



