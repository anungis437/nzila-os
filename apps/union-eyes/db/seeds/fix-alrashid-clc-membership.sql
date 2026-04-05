-- =============================================================================
-- Fix: Ensure f.alrashid@clc-ctc.ca is a secretary_treasurer member of CLC
--
-- Problem: User appears as CAPE member instead of CLC.
-- Root cause: organization_members row may point to wrong org, or her Clerk
-- user ID doesn't match the seed data user_id.
--
-- This script:
-- 1. Updates any existing org_members row for her email to point to CLC
-- 2. Sets her role to secretary_treasurer
-- 3. If no row exists, creates one (requires her Clerk user_id as parameter)
-- =============================================================================
BEGIN;

-- Get CLC org ID
DO $$
DECLARE
  v_clc_id uuid;
  v_existing_count int;
BEGIN
  SELECT id INTO v_clc_id FROM organizations WHERE slug = 'clc';

  IF v_clc_id IS NULL THEN
    RAISE EXCEPTION 'CLC organization not found';
  END IF;

  -- Check if there's an existing membership for this email in any org
  SELECT count(*) INTO v_existing_count
  FROM organization_members
  WHERE email = 'f.alrashid@clc-ctc.ca';

  IF v_existing_count > 0 THEN
    -- Update existing row(s) to point to CLC with correct role
    UPDATE organization_members
    SET organization_id = v_clc_id,
        role = 'secretary_treasurer',
        name = 'Fatima Al-Rashid',
        status = 'active',
        updated_at = now()
    WHERE email = 'f.alrashid@clc-ctc.ca';

    RAISE NOTICE 'Updated % existing membership(s) to CLC secretary_treasurer', v_existing_count;
  ELSE
    -- No existing row by email — check by the seed user_id
    SELECT count(*) INTO v_existing_count
    FROM organization_members
    WHERE user_id = 'user_3BSzDtwjg8WXJf36fw9wjVTu8yX';

    IF v_existing_count > 0 THEN
      UPDATE organization_members
      SET organization_id = v_clc_id,
          role = 'secretary_treasurer',
          name = 'Fatima Al-Rashid',
          email = 'f.alrashid@clc-ctc.ca',
          status = 'active',
          updated_at = now()
      WHERE user_id = 'user_3BSzDtwjg8WXJf36fw9wjVTu8yX';

      RAISE NOTICE 'Updated seed user membership to CLC secretary_treasurer';
    ELSE
      RAISE NOTICE 'No existing membership found. Insert manually with actual Clerk user_id:';
      RAISE NOTICE 'INSERT INTO organization_members (user_id, organization_id, role, status, name, email) VALUES (''<clerk_user_id>'', ''%'', ''secretary_treasurer'', ''active'', ''Fatima Al-Rashid'', ''f.alrashid@clc-ctc.ca'');', v_clc_id;
    END IF;
  END IF;
END $$;

COMMIT;
