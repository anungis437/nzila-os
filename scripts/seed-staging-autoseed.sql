-- Auto-seeder: dynamically inserts rows into all empty tables
-- Uses actual schema info to generate correct INSERT statements

DO $$
DECLARE
  tbl RECORD;
  col RECORD;
  col_list TEXT;
  val_list TEXT;
  val_list2 TEXT;
  col_count INT;
  insert_sql TEXT;
  cape_org UUID := '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
  clc_org UUID := '5ecb17ab-b5de-442e-a46f-93778ee496aa';
  nzila_org UUID := '458a56cb-251a-4c91-a0b5-81bb8ac39087';
  cape_member UUID := 'c66bf357-4282-46f1-a237-2b5085448803';
  clc_member UUID := '5707857c-48d8-4023-9744-0140e362bd6a';
  uuid1 UUID;
  uuid2 UUID;
  success_count INT := 0;
  fail_count INT := 0;
  skip_count INT := 0;
  row_count BIGINT;
BEGIN
  -- Force all deferred FK constraints to check immediately
  -- so per-INSERT exception handlers can catch violations
  SET CONSTRAINTS ALL IMMEDIATE;

  FOR tbl IN
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND t.table_name NOT LIKE 'stripe_%'
      AND t.table_name NOT LIKE 'qbo_%'
      AND t.table_name NOT LIKE 'external_%'
      AND t.table_name NOT LIKE 'django_%'
      AND t.table_name NOT LIKE 'auth_%'
      AND t.table_name NOT LIKE 'celery_%'
      AND t.table_name NOT LIKE 'sync_%'
      AND t.table_name NOT LIKE 'audit_%'
      AND t.table_name NOT LIKE 'webhook_%'
      AND t.table_name NOT LIKE 'ml_%'
      AND t.table_name NOT LIKE 'ai_%'
    ORDER BY t.table_name
  LOOP
    -- Check if table already has data
    EXECUTE format('SELECT count(*) FROM public.%I LIMIT 1', tbl.table_name) INTO row_count;
    IF row_count > 0 THEN
      skip_count := skip_count + 1;
      CONTINUE;
    END IF;

    -- Build column list and value list from all columns
    col_list := '';
    val_list := '';
    val_list2 := '';
    col_count := 0;
    
    -- Generate two UUIDs for this table
    uuid1 := gen_random_uuid();
    uuid2 := gen_random_uuid();

    FOR col IN
      SELECT c.column_name, c.data_type, c.udt_name, c.is_nullable, c.column_default,
             c.character_maximum_length, c.ordinal_position
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = tbl.table_name
      ORDER BY c.ordinal_position
    LOOP
      -- Skip columns with defaults (they auto-fill)
      IF col.column_default IS NOT NULL AND col.column_name != 'id' THEN
        CONTINUE;
      END IF;
      -- Skip nullable columns (not required)
      IF col.is_nullable = 'YES' AND col.column_name != 'id' THEN
        CONTINUE;
      END IF;

      col_count := col_count + 1;
      IF col_count > 1 THEN
        col_list := col_list || ', ';
        val_list := val_list || ', ';
        val_list2 := val_list2 || ', ';
      END IF;

      col_list := col_list || quote_ident(col.column_name);

      -- Generate value based on column name and type
      IF col.column_name = 'id' THEN
        val_list := val_list || quote_literal(uuid1::text);
        val_list2 := val_list2 || quote_literal(uuid2::text);

      ELSIF col.column_name IN ('organization_id', 'org_id', 'tenant_id') THEN
        val_list := val_list || quote_literal(cape_org::text);
        val_list2 := val_list2 || quote_literal(clc_org::text);

      ELSIF col.column_name IN ('entity_id') THEN
        val_list := val_list || quote_literal(cape_org::text);
        val_list2 := val_list2 || quote_literal(clc_org::text);

      ELSIF col.column_name IN ('user_id', 'member_id', 'clerk_user_id', 'created_by', 'uploaded_by', 'approved_by', 'requested_by', 'assigned_to', 'reporter_id', 'assignee_id', 'author_id', 'prepared_by', 'reviewed_by', 'raised_by', 'opened_by', 'submitter_id', 'respondent_id') THEN
        IF col.data_type = 'uuid' THEN
          val_list := val_list || quote_literal(cape_member::text);
          val_list2 := val_list2 || quote_literal(clc_member::text);
        ELSE
          val_list := val_list || quote_literal('user_cape_01');
          val_list2 := val_list2 || quote_literal('user_clc_01');
        END IF;

      ELSIF col.column_name IN ('partner_id', 'employer_id', 'federation_id', 'parent_id', 'shareholder_id', 'from_organization_id', 'to_organization_id', 'from_shareholder_id', 'to_shareholder_id', 'band_council_id') THEN
        val_list := val_list || quote_literal(cape_org::text);
        val_list2 := val_list2 || quote_literal(clc_org::text);

      ELSIF col.column_name LIKE '%_id' AND col.data_type = 'uuid' THEN
        -- FK reference — use the table's own uuid1/uuid2 as self-ref (will likely be fine with ON CONFLICT DO NOTHING)
        val_list := val_list || quote_literal(uuid1::text);
        val_list2 := val_list2 || quote_literal(uuid2::text);

      ELSIF col.data_type IN ('timestamp with time zone', 'timestamp without time zone') THEN
        val_list := val_list || 'now()';
        val_list2 := val_list2 || 'now()';

      ELSIF col.data_type = 'date' THEN
        val_list := val_list || 'CURRENT_DATE';
        val_list2 := val_list2 || 'CURRENT_DATE';

      ELSIF col.data_type = 'boolean' THEN
        val_list := val_list || 'true';
        val_list2 := val_list2 || 'true';

      ELSIF col.data_type = 'integer' OR col.data_type = 'smallint' THEN
        val_list := val_list || '1';
        val_list2 := val_list2 || '2';

      ELSIF col.data_type = 'bigint' THEN
        val_list := val_list || '1';
        val_list2 := val_list2 || '2';

      ELSIF col.data_type = 'numeric' OR col.data_type = 'double precision' OR col.data_type = 'real' THEN
        val_list := val_list || '100.00';
        val_list2 := val_list2 || '200.00';

      ELSIF col.data_type = 'jsonb' OR col.data_type = 'json' THEN
        val_list := val_list || quote_literal('{}');
        val_list2 := val_list2 || quote_literal('{}');

      ELSIF col.data_type = 'ARRAY' THEN
        val_list := val_list || quote_literal('{}');
        val_list2 := val_list2 || quote_literal('{}');

      ELSIF col.udt_name != '' AND col.data_type = 'USER-DEFINED' THEN
        -- Enum type - get first valid value
        DECLARE
          enum_val TEXT;
        BEGIN
          SELECT e.enumlabel INTO enum_val
          FROM pg_type t2
          JOIN pg_enum e ON e.enumtypid = t2.oid
          WHERE t2.typname = col.udt_name
          ORDER BY e.enumsortorder
          LIMIT 1;
          
          IF enum_val IS NOT NULL THEN
            val_list := val_list || quote_literal(enum_val);
            val_list2 := val_list2 || quote_literal(enum_val);
          ELSE
            val_list := val_list || quote_literal('default');
            val_list2 := val_list2 || quote_literal('default');
          END IF;
        END;

      ELSIF col.data_type IN ('character varying', 'text', 'character') THEN
        IF col.column_name IN ('email', 'contact_email', 'user_email', 'bidder_email', 'payee_email', 'payer_email') THEN
          val_list := val_list || quote_literal('admin@cape-union.ca');
          val_list2 := val_list2 || quote_literal('admin@clc-congress.ca');
        ELSIF col.column_name IN ('name', 'display_name', 'title', 'label', 'fund_name', 'policy_name', 'rule_name', 'program_name', 'task_name', 'drill_name', 'milestone', 'certification_name', 'campaign_name', 'account_name', 'contact_name', 'role_name', 'description', 'content', 'body', 'slug', 'quote', 'message', 'subject', 'reason', 'ref', 'code', 'account_code', 'clause_number', 'claim_number', 'cba_number', 'certificate_number', 'certification_number', 'audit_number', 'record_number', 'request_number', 'pack_id', 'track_id', 'event_id', 'artifact_id', 'period_label', 'period_type', 'fiscal_year_label') THEN
            val_list := val_list || quote_literal(col.column_name || '_cape_1');
            val_list2 := val_list2 || quote_literal(col.column_name || '_clc_1');
        ELSIF col.column_name IN ('jurisdiction', 'province', 'province_of_registration', 'country', 'geography_code', 'noc_code') THEN
            val_list := val_list || quote_literal('ON');
            val_list2 := val_list2 || quote_literal('BC');
        ELSIF col.column_name IN ('currency', 'payout_currency', 'payment_currency') THEN
            val_list := val_list || quote_literal('CAD');
            val_list2 := val_list2 || quote_literal('CAD');
        ELSIF col.column_name IN ('status') THEN
            val_list := val_list || quote_literal('active');
            val_list2 := val_list2 || quote_literal('active');
        ELSIF col.column_name IN ('type', 'payment_type', 'action_type', 'violation_type', 'filing_type', 'notice_type', 'transaction_type', 'entry_type', 'update_type', 'contact_type', 'change_type', 'knowledge_type', 'breach_type', 'event_type', 'export_type', 'claim_type', 'data_type', 'data_type_requested', 'resource_type', 'target_entity_type', 'link_type', 'artifact_type') THEN
            val_list := val_list || quote_literal('general');
            val_list2 := val_list2 || quote_literal('general');
        ELSIF col.column_name IN ('hash', 'sha256', 'previous_hash', 'record_hash') THEN
            val_list := val_list || quote_literal('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
            val_list2 := val_list2 || quote_literal('a3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
        ELSIF col.column_name IN ('blob_container', 'storage_key', 'base_path', 'blob_path', 'storage_url', 'cover_art_url', 'avatar_url', 'action_url', 'donation_page_url', 'understanding_url', 'how_to_meet_url') THEN
            val_list := val_list || quote_literal('https://storage.example.com/cape');
            val_list2 := val_list2 || quote_literal('https://storage.example.com/clc');
        ELSIF col.column_name IN ('content_type') THEN
            val_list := val_list || quote_literal('application/pdf');
            val_list2 := val_list2 || quote_literal('application/pdf');
        ELSIF col.column_name IN ('ip_address') THEN
            val_list := val_list || quote_literal('10.0.0.1');
            val_list2 := val_list2 || quote_literal('10.0.0.2');
        ELSIF col.column_name IN ('user_agent') THEN
            val_list := val_list || quote_literal('Mozilla/5.0');
            val_list2 := val_list2 || quote_literal('Mozilla/5.0');
        ELSIF col.column_name IN ('access_token') THEN
            val_list := val_list || quote_literal('tok_cape_placeholder');
            val_list2 := val_list2 || quote_literal('tok_clc_placeholder');
        ELSIF col.column_name IN ('embedding_vector') THEN
            val_list := val_list || quote_literal('[0.1,0.2,0.3]');
            val_list2 := val_list2 || quote_literal('[0.4,0.5,0.6]');
        ELSIF col.column_name IN ('vertical') THEN
            val_list := val_list || quote_literal('public-sector');
            val_list2 := val_list2 || quote_literal('private-sector');
        ELSIF col.column_name IN ('role', 'approver_role', 'user_role', 'actor_role') THEN
            val_list := val_list || quote_literal('admin');
            val_list2 := val_list2 || quote_literal('member');
        ELSIF col.column_name IN ('level', 'classification_level', 'severity', 'priority') THEN
            val_list := val_list || quote_literal('medium');
            val_list2 := val_list2 || quote_literal('medium');
        ELSIF col.column_name IN ('method', 'payment_method', 'match_method') THEN
            val_list := val_list || quote_literal('bank_transfer');
            val_list2 := val_list2 || quote_literal('bank_transfer');
        ELSIF col.column_name IN ('provider', 'source', 'detected_by', 'audited_by') THEN
            val_list := val_list || quote_literal('system');
            val_list2 := val_list2 || quote_literal('system');
        ELSIF col.column_name IN ('industry_sector', 'sector', 'genre') THEN
            val_list := val_list || quote_literal('general');
            val_list2 := val_list2 || quote_literal('general');
        ELSE
            val_list := val_list || quote_literal(col.column_name || '_val1');
            val_list2 := val_list2 || quote_literal(col.column_name || '_val2');
        END IF;

      ELSE
        -- Fallback for unknown types
        val_list := val_list || quote_literal('');
        val_list2 := val_list2 || quote_literal('');
      END IF;
    END LOOP;

    IF col_count = 0 THEN
      skip_count := skip_count + 1;
      CONTINUE;
    END IF;

    -- Execute INSERT for two rows (CAPE + CLC)
    insert_sql := format(
      'INSERT INTO public.%I (%s) VALUES (%s), (%s) ON CONFLICT DO NOTHING',
      tbl.table_name, col_list, val_list, val_list2
    );

    BEGIN
      EXECUTE insert_sql;
      success_count := success_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'FAILED %: % | SQL: %', tbl.table_name, SQLERRM, left(insert_sql, 500);
      fail_count := fail_count + 1;
    END;
  END LOOP;

  RAISE NOTICE '=== AUTO-SEED COMPLETE: % succeeded, % failed, % skipped (already populated) ===', success_count, fail_count, skip_count;
END $$;
