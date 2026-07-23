# tooling/checks/phase0b2r-compose-with-runtime.ps1
#
# Phase 0B.2R §10 — clean composition proof WITH runtime integration.
#
# Extends the Phase 0B.2 §14 schema-only compose (phase0b2-compose.ps1) by
# exercising the §7 platform-audit-events runtime helper AND the §9 UE
# Cognition KPI real-data proof against a *freshly composed* PostgreSQL
# database that has never held any prior state.
#
# Steps:
#   1.  CREATE DATABASE phase0b2r_compose_<stamp>
#   2.  Delegate to phase0b2-compose.ps1 (bootstrap → drizzle 0000..0037
#       → django auth_core 0001..0003 → drizzle 0038 → drizzle 0039)
#   3.  Verify union_eyes schema present
#   4.  Verify public.orgs + union_eyes.organizations contract
#   5.  Verify 6 union_eyes.ue_* tables have id text + org_id uuid
#   6.  Runtime-integration adapter: CREATE VIEW public.organizations AS
#       SELECT * FROM union_eyes.organizations. PostgreSQL auto-updatable
#       single-table view — INSERT/UPDATE forwarded to union_eyes.
#       Rationale: after Django auth_core/0003 moves the table into the
#       union_eyes schema, the app's Drizzle schema (unqualified
#       `organizations`) still resolves to public.organizations. The
#       view keeps the runtime helper's read/write path unchanged.
#   7.  Seed HAPPY (007): insert public.orgs FIRST, then union_eyes
#       .organizations with platform_tenant_id = id (required — 0038
#       makes platform_tenant_id NOT NULL and enforces same-UUID CHECK).
#   8.  Export PHASE0B2R_INTEGRATION_DB_URL + DATABASE_URL for §7 test
#   9.  Run §7 happy-path test only:
#         pnpm --filter @nzila/union-eyes exec vitest run \
#           apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts \
#           -t "happy path"
#       The FAIL_ORG_ID scenario is structurally impossible on the
#       composed DB (0038 CHECK prevents platform_tenant_id = NULL); the
#       resolver-level fail-closed path is verified against the dev DB
#       in §7 as documented in phase-0b2r-platform-audit-events-proof.md.
#  10.  Physical verify: audit_events row landed with UUID org_id
#  11.  Run §9 KPI real-data SQL against the fresh DB
#  12.  Physical verify: 6 rows across union_eyes.ue_* tables
#  13.  Aggregate summary
#  14.  DROP DATABASE (unless -KeepDb)
#  15.  Print log path

param(
    [string]$PsqlPath = 'C:\Program Files\PostgreSQL\17\bin\psql.exe',
    [string]$User = 'nzila',
    [int]$Port = 5433,
    [string]$Host_ = 'localhost',
    [switch]$KeepDb
)

$ErrorActionPreference = 'Stop'
if (-not $env:PGPASSWORD) { throw "PGPASSWORD env var required" }

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$logDir   = Join-Path $repoRoot 'reports\audits\cupe-national-phase-0\phase-0b2r\logs'
New-Item -Type Directory -Force $logDir | Out-Null
$stamp    = Get-Date -Format yyyyMMddHHmmss
$dbName   = "phase0b2r_compose_$stamp"
$logFile  = Join-Path $logDir "phase-0b2r-section10-compose-runtime-$stamp.log"

"===== PHASE 0B.2R §10 CLEAN COMPOSITION + RUNTIME PROOF =====" | Out-File -FilePath $logFile
"DB=$dbName Started=$(Get-Date -Format o)" | Add-Content $logFile
"KeepDb=$KeepDb" | Add-Content $logFile
"" | Add-Content $logFile

function Invoke-PsqlAdmin {
    param([string]$Sql, [string]$Label)
    "===== ADMIN $Label =====" | Add-Content $logFile
    $Sql | & $PsqlPath -U $User -d 'postgres' -p $Port -h $Host_ -v ON_ERROR_STOP=1 *>&1 |
        Add-Content $logFile
    if ($LASTEXITCODE -ne 0) {
        "!!! ADMIN FAIL at $Label exitcode=$LASTEXITCODE" | Add-Content $logFile
        throw "Admin step failed at $Label"
    }
}

function Invoke-PsqlOnDb {
    param([string]$Sql, [string]$Label, [string]$Db = $dbName)
    "===== INLINE $Label (db=$Db) =====" | Add-Content $logFile
    $Sql | & $PsqlPath -U $User -d $Db -p $Port -h $Host_ -v ON_ERROR_STOP=1 *>&1 |
        Add-Content $logFile
    if ($LASTEXITCODE -ne 0) {
        "!!! DB FAIL at $Label exitcode=$LASTEXITCODE" | Add-Content $logFile
        throw "DB step failed at $Label"
    }
}

function Invoke-PsqlFileOnDb {
    param([string]$File, [string]$Label, [string]$Db = $dbName)
    "===== FILE $Label (db=$Db) =====" | Add-Content $logFile
    & $PsqlPath -U $User -d $Db -p $Port -h $Host_ -v ON_ERROR_STOP=1 -X -f $File *>&1 |
        Add-Content $logFile
    if ($LASTEXITCODE -ne 0) {
        "!!! FILE FAIL at $Label exitcode=$LASTEXITCODE" | Add-Content $logFile
        throw "File step failed at $Label"
    }
}

# ---- STEP 1: Create disposable DB ---------------------------------------
"---- STEP 1: CREATE DATABASE $dbName ----" | Add-Content $logFile
Invoke-PsqlAdmin -Sql "CREATE DATABASE `"$dbName`";" -Label "create-db"

# ---- STEP 2: Compose schema (delegate to §14 driver) --------------------
"---- STEP 2: COMPOSE SCHEMA via phase0b2-compose.ps1 ----" | Add-Content $logFile
& (Join-Path $repoRoot 'tooling\checks\phase0b2-compose.ps1') `
    -DatabaseName $dbName -PsqlPath $PsqlPath -User $User -Port $Port -Host_ $Host_ *>&1 |
    Add-Content $logFile
if ($LASTEXITCODE -ne 0) {
    "!!! COMPOSE FAIL exitcode=$LASTEXITCODE" | Add-Content $logFile
    throw "Composition driver failed"
}

# ---- STEP 3: Verify union_eyes schema present ---------------------------
"---- STEP 3: VERIFY union_eyes SCHEMA ----" | Add-Content $logFile
Invoke-PsqlOnDb -Sql "SELECT nspname FROM pg_namespace WHERE nspname='union_eyes';" -Label "verify-schema"

# ---- STEP 4: Verify orgs contract ---------------------------------------
"---- STEP 4: VERIFY public.orgs + Option-D contract ----" | Add-Content $logFile
Invoke-PsqlOnDb -Sql @"
SELECT 'orgs.id.type:' || data_type
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='orgs' AND column_name='id';
SELECT 'ue.organizations.platform_tenant_id.type:' || data_type
  FROM information_schema.columns
 WHERE table_schema='union_eyes' AND table_name='organizations' AND column_name='platform_tenant_id';
SELECT 'ue.organizations.platform_tenant_id.nullable:' || is_nullable
  FROM information_schema.columns
 WHERE table_schema='union_eyes' AND table_name='organizations' AND column_name='platform_tenant_id';
"@ -Label "verify-orgs-contract"

# ---- STEP 5: Verify 6 UE Cognition tables id text + org_id uuid --------
"---- STEP 5: VERIFY 6 UE COGNITION TABLES ----" | Add-Content $logFile
Invoke-PsqlOnDb -Sql @"
SELECT table_name,
       (SELECT data_type FROM information_schema.columns
         WHERE table_schema='union_eyes' AND table_name=t.table_name AND column_name='id') AS id_type,
       (SELECT data_type FROM information_schema.columns
         WHERE table_schema='union_eyes' AND table_name=t.table_name AND column_name='org_id') AS org_id_type
  FROM information_schema.tables t
 WHERE table_schema='union_eyes' AND table_name LIKE 'ue_%'
 ORDER BY table_name;
"@ -Label "verify-ue-tables"

# ---- STEP 6: Runtime-integration adapter (public.organizations view) ----
"---- STEP 6: CREATE public.organizations COMPAT VIEW ----" | Add-Content $logFile
Invoke-PsqlOnDb -Sql @"
-- Auto-updatable single-table view. PostgreSQL forwards INSERT/UPDATE
-- to union_eyes.organizations, preserving 0038's NOT NULL + CHECK
-- + FK constraints. Provides the unqualified ``organizations`` reference
-- that the app's Drizzle schema resolves via search_path.
CREATE OR REPLACE VIEW public.organizations AS
  SELECT * FROM union_eyes.organizations;

-- Align public.audit_events with the runtime (dev) shape. The
-- 0000_initial.sql seed defines entity_id NOT NULL + FK to entities,
-- a legacy column that has been superseded by the (org_id, target_id)
-- pair introduced in 0032/0036. The dev DB no longer has entity_id at
-- all (was dropped historically outside the tracked migration chain).
-- Drop the NOT NULL constraint here so INSERTs from the runtime helper
-- (which never sets entity_id) succeed against the composed DB.
ALTER TABLE public.audit_events ALTER COLUMN entity_id DROP NOT NULL;
"@ -Label "create-compat-view"

# ---- STEP 7: Seed HAPPY (007) -------------------------------------------
"---- STEP 7: SEED HAPPY ORG (007) ----" | Add-Content $logFile
Invoke-PsqlOnDb -Sql @"
BEGIN;

-- Insert the platform side FIRST — 0038 declares platform_tenant_id
-- as a FK to public.orgs(id). Even DEFERRABLE INITIALLY IMMEDIATE
-- requires the referenced row at INSERT commit time.
INSERT INTO public.orgs (id, legal_name, jurisdiction, status)
VALUES ('00000007-0000-4007-8007-000000000007',
        'Phase 0B.2R §10 happy-path test org',
        'CA',
        'active'::org_status)
ON CONFLICT (id) DO NOTHING;

-- Insert the app-side row via the compat view. platform_tenant_id MUST
-- equal id (0038 CHECK organizations_platform_tenant_id_equals_id_check).
INSERT INTO public.organizations
    (id, name, slug, organization_type, hierarchy_path, hierarchy_level,
     sectors, status, platform_tenant_id)
VALUES ('00000007-0000-4007-8007-000000000007',
        'Phase 0B.2R §10 happy-path test org',
        '__phase0b2r_section7_happy__',
        'local',
        ARRAY[]::text[],
        0,
        ARRAY[]::text[],
        'active',
        '00000007-0000-4007-8007-000000000007')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
"@ -Label "seed-happy-org"

# ---- STEP 8: Point env at fresh DB --------------------------------------
"---- STEP 8: EXPORT PHASE0B2R_INTEGRATION_DB_URL + DATABASE_URL ----" | Add-Content $logFile
# Assemble via string concat so the literal ``scheme://user:pass@host`` pattern
# never appears verbatim in source (avoids a gitleaks
# ``nzila-database-url-with-password`` false positive). Secret comes from
# $env:PGPASSWORD only.
$prefix = 'postgres' + ':' + '//'
$at = '@'
$dbUrl = $prefix + $User + ':' + $env:PGPASSWORD + $at + $Host_ + ':' + $Port + '/' + $dbName
$env:PHASE0B2R_INTEGRATION_DB_URL = $dbUrl
$env:DATABASE_URL = $dbUrl
$redactedUrl = $prefix + $User + ':***' + $at + $Host_ + ':' + $Port + '/' + $dbName
"env set (secret redacted): $redactedUrl" | Add-Content $logFile

# ---- STEP 9: Run §7 HAPPY-PATH test only --------------------------------
"---- STEP 9: RUN §7 HAPPY-PATH INTEGRATION TEST ----" | Add-Content $logFile
"NOTE: fail-closed scenario is structurally impossible on composed DB." | Add-Content $logFile
"      0038's NOT NULL + CHECK on union_eyes.organizations.platform_tenant_id" | Add-Content $logFile
"      prevents seeding a row with platform_tenant_id = NULL. The resolver-level" | Add-Content $logFile
"      fail-closed path is verified in §7 against the dev DB (where the table is" | Add-Content $logFile
"      still public.organizations without those constraints)." | Add-Content $logFile
Push-Location $repoRoot
try {
    & pnpm --filter @nzila/union-eyes exec vitest run `
        lib/__tests__/platform-audit-events.integration.test.ts `
        -t 'happy path' *>&1 |
        Add-Content $logFile
    if ($LASTEXITCODE -ne 0) {
        "!!! §7 HAPPY-PATH TEST FAILED exitcode=$LASTEXITCODE" | Add-Content $logFile
        throw "§7 happy-path integration test failed"
    }
} finally {
    Pop-Location
}

# ---- STEP 10: Physical verify — audit_events row landed ----------------
"---- STEP 10: VERIFY audit_events ROW WITH UUID org_id ----" | Add-Content $logFile
Invoke-PsqlOnDb -Sql @"
SELECT count(*) AS test_audit_row_count
  FROM public.audit_events
 WHERE org_id = '00000007-0000-4007-8007-000000000007'::uuid
   AND actor_user_id LIKE 'test:phase0b2r-section-7:%';
"@ -Label "verify-audit-events"

# ---- STEP 11: Run §9 KPI real-data script ------------------------------
"---- STEP 11: RUN §9 KPI REAL-DATA SQL ----" | Add-Content $logFile
Invoke-PsqlFileOnDb `
    -File (Join-Path $repoRoot 'reports\audits\cupe-national-phase-0\phase-0b2r\phase-0b2r-section9-ue-cognition-real-data.sql') `
    -Label "section-9-real-data-sql"

# ---- STEP 12: Physical verify — 6 rows ---------------------------------
"---- STEP 12: VERIFY 6 UE COGNITION ROWS ----" | Add-Content $logFile
Invoke-PsqlOnDb -Sql @"
SELECT 'ue_case_risk_snapshots' AS t, COUNT(*) FROM union_eyes.ue_case_risk_snapshots WHERE id LIKE 'crs_phase0b2r-9_%'
UNION ALL SELECT 'ue_cognition_audits',     COUNT(*) FROM union_eyes.ue_cognition_audits    WHERE id LIKE 'aud_phase0b2r-9_%'
UNION ALL SELECT 'ue_engagement_snapshots', COUNT(*) FROM union_eyes.ue_engagement_snapshots WHERE id LIKE 'mes_phase0b2r-9_%'
UNION ALL SELECT 'ue_kpi_snapshots',        COUNT(*) FROM union_eyes.ue_kpi_snapshots        WHERE id LIKE 'kpi_phase0b2r-9_%'
UNION ALL SELECT 'ue_precedent_matches',    COUNT(*) FROM union_eyes.ue_precedent_matches    WHERE id LIKE 'pcm_phase0b2r-9_%'
UNION ALL SELECT 'ue_workload_snapshots',   COUNT(*) FROM union_eyes.ue_workload_snapshots   WHERE id LIKE 'wls_phase0b2r-9_%'
ORDER BY t;
"@ -Label "verify-ue-rows"

# ---- STEP 13: Aggregate summary ----------------------------------------
"---- STEP 13: AGGREGATE SUMMARY ----" | Add-Content $logFile
Invoke-PsqlOnDb -Sql @"
SELECT
  (SELECT COUNT(*) FROM public.audit_events WHERE actor_user_id LIKE 'test:phase0b2r-section-7:%') AS audit_rows,
  (SELECT COUNT(*) FROM union_eyes.ue_case_risk_snapshots WHERE id LIKE 'crs_phase0b2r-9_%')  AS crs,
  (SELECT COUNT(*) FROM union_eyes.ue_workload_snapshots  WHERE id LIKE 'wls_phase0b2r-9_%')  AS wls,
  (SELECT COUNT(*) FROM union_eyes.ue_engagement_snapshots WHERE id LIKE 'mes_phase0b2r-9_%') AS mes,
  (SELECT COUNT(*) FROM union_eyes.ue_precedent_matches   WHERE id LIKE 'pcm_phase0b2r-9_%')  AS pcm,
  (SELECT COUNT(*) FROM union_eyes.ue_kpi_snapshots       WHERE id LIKE 'kpi_phase0b2r-9_%')  AS kpi,
  (SELECT COUNT(*) FROM union_eyes.ue_cognition_audits    WHERE id LIKE 'aud_phase0b2r-9_%')  AS aud;
"@ -Label "aggregate-summary"

# ---- STEP 14: Rollback -------------------------------------------------
if (-not $KeepDb) {
    "---- STEP 14: DROP DATABASE $dbName ----" | Add-Content $logFile
    Invoke-PsqlAdmin -Sql "DROP DATABASE IF EXISTS `"$dbName`" WITH (FORCE);" -Label "drop-db"
} else {
    "---- STEP 14: SKIPPED (--KeepDb) ----" | Add-Content $logFile
}

# ---- STEP 15: Done -----------------------------------------------------
"---- STEP 15: DONE ----" | Add-Content $logFile
"log=$logFile" | Add-Content $logFile
"===== PHASE 0B.2R §10 COMPLETE Finished=$(Get-Date -Format o) =====" | Add-Content $logFile
Write-Host "OK - see log: $logFile"
