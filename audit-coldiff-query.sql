-- Column-level diff for tables with count mismatches
-- Tables: claim_deadlines (L27 vs S28), deadline_rules (L20 vs S21),
--         grievance_deadlines (L14 vs S35), org_members (L28 vs S30),
--         claim_updates (L11 vs S9 — now fixed), grievance_transitions (L18 vs S16 — now fixed)

-- claim_deadlines columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'claim_deadlines' AND table_schema = 'public'
ORDER BY ordinal_position;

-- deadline_rules columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'deadline_rules' AND table_schema = 'public'
ORDER BY ordinal_position;

-- grievance_deadlines columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'grievance_deadlines' AND table_schema = 'public'
ORDER BY ordinal_position;

-- organization_members columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'organization_members' AND table_schema = 'public'
ORDER BY ordinal_position;
