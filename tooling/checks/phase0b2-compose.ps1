# tooling/checks/phase0b2-compose.ps1
#
# Phase 0B.2 §14 — clean-DB composition proof driver.
#
# Reads packages/db/drizzle/.known-partial-failures.json to know which
# incremental Drizzle migrations are intentionally allowed to abort
# during a clean-DB replay (each one paired with a downstream healer).
#
# Ordered replay (all applied by psql, no drizzle-kit / Django installed):
#   1. bootstrap: packages/db/bootstrap/0000_platform_schema_prerequisites.sql
#   2. Drizzle 0000..0037 (tolerating allowlisted mid-file aborts)
#   3. Django auth_core/0001..0003 (SQL projection: create public.organizations
#      + move to union_eyes schema)
#   4. Drizzle 0038 (adds platform_tenant_id + FK to public.orgs)
#   5. Django auth_core/0004 + billing/0002 (state-only — no DB ops)
#   6. Drizzle 0039 (ue_cognition text-id promotion)
#
# Emits a per-step log to reports/audits/cupe-national-phase-0/phase-0b2/logs/.

param(
    [string]$DatabaseName,
    [string]$PsqlPath = 'C:\Program Files\PostgreSQL\17\bin\psql.exe',
    [string]$User = 'nzila',
    [int]$Port = 5433,
    [string]$Host_ = 'localhost'
)

$ErrorActionPreference = 'Stop'
if (-not $DatabaseName) { throw "DatabaseName required (pass -DatabaseName <name>)" }
if (-not $env:PGPASSWORD) { throw "PGPASSWORD env var required" }

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$drizzleDir = Join-Path $repoRoot 'packages\db\drizzle'
$bootstrapFile = Join-Path $repoRoot 'packages\db\bootstrap\0000_platform_schema_prerequisites.sql'
$allowlistFile = Join-Path $drizzleDir '.known-partial-failures.json'
$logDir = Join-Path $repoRoot 'reports\audits\cupe-national-phase-0\phase-0b2\logs'
New-Item -Type Directory -Force $logDir | Out-Null
$stamp = Get-Date -Format yyyyMMddHHmmss
$logFile = Join-Path $logDir "phase-0b2-compose-$stamp.log"
"===== PHASE 0B.2 §14 COMPOSITION PROOF =====" | Out-File -FilePath $logFile
"DB=$DatabaseName Started=$(Get-Date -Format o)" | Add-Content $logFile
"" | Add-Content $logFile

# Load allowlist
$allowlist = (Get-Content $allowlistFile -Raw | ConvertFrom-Json).entries |
    ForEach-Object { $_.filename }
"Allowlisted mid-file aborts (each paired with a healer): $($allowlist -join ', ')" | Add-Content $logFile
"" | Add-Content $logFile

function Invoke-Psql {
    param([string]$File, [string]$Label, [bool]$AllowError = $false)
    "===== APPLY $Label =====" | Add-Content $logFile
    & $PsqlPath -U $User -d $DatabaseName -p $Port -h $Host_ -v ON_ERROR_STOP=1 -X -f $File *>&1 |
        Add-Content $logFile
    if ($LASTEXITCODE -ne 0) {
        if ($AllowError) {
            "!!! ALLOWLISTED partial-apply at $Label exitcode=$LASTEXITCODE (healer expected)" |
                Add-Content $logFile
            return $false
        } else {
            "!!! HARD FAIL at $Label exitcode=$LASTEXITCODE" | Add-Content $logFile
            throw "Composition failed at $Label"
        }
    }
    return $true
}

function Invoke-PsqlSql {
    param([string]$Sql, [string]$Label)
    "===== INLINE $Label =====" | Add-Content $logFile
    $Sql | & $PsqlPath -U $User -d $DatabaseName -p $Port -h $Host_ -v ON_ERROR_STOP=1 *>&1 |
        Add-Content $logFile
    if ($LASTEXITCODE -ne 0) {
        "!!! HARD FAIL inline $Label exitcode=$LASTEXITCODE" | Add-Content $logFile
        throw "Composition failed at inline $Label"
    }
}

# ---- Step 1: bootstrap ---------------------------------------------------
"---- STEP 1: BOOTSTRAP ----" | Add-Content $logFile
Invoke-Psql -File $bootstrapFile -Label 'bootstrap/0000_platform_schema_prerequisites.sql' | Out-Null

# ---- Step 2: Drizzle 0000..0037 -----------------------------------------
"---- STEP 2: DRIZZLE 0000..0037 ----" | Add-Content $logFile
$drizzleBaseline = Get-ChildItem $drizzleDir\*.sql |
    Where-Object { $_.Name -match '^00[0-3][0-9]_' -and $_.Name -notmatch '^003[89]_' } |
    Sort-Object Name
$partialCount = 0
foreach ($m in $drizzleBaseline) {
    $isAllowlisted = $allowlist -contains $m.Name
    $ok = Invoke-Psql -File $m.FullName -Label $m.Name -AllowError $isAllowlisted
    if (-not $ok) { $partialCount++ }
}
"Baseline complete. Partial-applies encountered: $partialCount" | Add-Content $logFile

# ---- Step 3: Django auth_core 0001..0003 (SQL projection) --------------
"---- STEP 3: DJANGO auth_core 0001..0003 (SQL projection) ----" | Add-Content $logFile
$djangoStep3 = @"
-- auth_core/0001_initial (SQL projection of Django CreateModel Organizations):
-- Minimal shape sufficient to satisfy §14 composition (only the columns that
-- migration 0038 or downstream code reference are projected; the full column
-- set is materialized via Django manage.py migrate in CI).
CREATE TABLE IF NOT EXISTS public.organizations (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 text NOT NULL,
    slug                 text NOT NULL UNIQUE,
    organization_type    text NOT NULL DEFAULT 'union',
    hierarchy_path       text[] NOT NULL DEFAULT ARRAY[]::text[],
    hierarchy_level      integer NOT NULL DEFAULT 0,
    sectors              text[] NOT NULL DEFAULT ARRAY[]::text[],
    status               text NOT NULL DEFAULT 'active',
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

-- auth_core/0002_add_clerk_organization_id: idempotent ADD COLUMN
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS clerk_organization_id text;

-- auth_core/0003_move_organizations_to_union_eyes: move table into union_eyes schema.
CREATE SCHEMA IF NOT EXISTS union_eyes;
DO `$mv`$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='organizations')
       AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='union_eyes' AND tablename='organizations') THEN
        ALTER TABLE public.organizations SET SCHEMA union_eyes;
    END IF;
END
`$mv`$;
"@
Invoke-PsqlSql -Sql $djangoStep3 -Label 'django-auth_core/0001..0003.sql-projection'

# ---- Step 4: Drizzle 0038 ---------------------------------------------
"---- STEP 4: DRIZZLE 0038 ----" | Add-Content $logFile
Invoke-Psql -File (Join-Path $drizzleDir '0038_organization_cross_schema_contract.sql') `
    -Label '0038_organization_cross_schema_contract.sql' | Out-Null

# ---- Step 5: Django auth_core/0004 + billing/0002 (state-only) --------
"---- STEP 5: DJANGO auth_core/0004 + billing/0002 (state-only per Django models — no DB ops) ----" | Add-Content $logFile
"    (These migrations use SeparateDatabaseAndState with empty database_operations." | Add-Content $logFile
"     The corresponding shared platform tables (organization_members, stripe_webhook_events)" | Add-Content $logFile
"     are declared in packages/db and already created by the Drizzle chain above." | Add-Content $logFile
"     Nothing to apply at the SQL level; Django state alone is enough.)" | Add-Content $logFile

# ---- Step 6: Drizzle 0039 ---------------------------------------------
"---- STEP 6: DRIZZLE 0039 ----" | Add-Content $logFile
Invoke-Psql -File (Join-Path $drizzleDir '0039_ue_cognition_text_id_promotion.sql') `
    -Label '0039_ue_cognition_text_id_promotion.sql' | Out-Null

# ---- Verification --------------------------------------------------------
"---- VERIFICATION ----" | Add-Content $logFile
$verifySql = @"
-- Schemas
SELECT 'schema:' || nspname AS obj FROM pg_namespace WHERE nspname IN ('public','union_eyes') ORDER BY nspname;
-- Option D contract on organizations
SELECT 'ue.organizations.platform_tenant_id.type:' || data_type::text
FROM information_schema.columns
WHERE table_schema='union_eyes' AND table_name='organizations' AND column_name='platform_tenant_id';
-- FK from union_eyes.organizations.platform_tenant_id -> public.orgs.id
SELECT 'fk:' || conname
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname='union_eyes' AND t.relname='organizations'
  AND c.contype='f' AND c.conname LIKE '%platform_tenant_id%';
-- CHECK (platform_tenant_id = id)
SELECT 'check:' || conname
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname='union_eyes' AND t.relname='organizations' AND c.contype='c';
-- UE cognition text-id tables
SELECT 'ue_table:' || table_name || '.' || column_name || ':' || data_type
FROM information_schema.columns
WHERE table_schema='union_eyes' AND column_name='id' AND table_name LIKE 'ue_%'
ORDER BY table_name;
-- Platform orgs presence
SELECT 'public.orgs.rowcount:' || count(*)::text FROM public.orgs;
"@
Invoke-PsqlSql -Sql $verifySql -Label 'verification'

"===== COMPOSITION COMPLETE Finished=$(Get-Date -Format o) =====" | Add-Content $logFile
Write-Host "OK — see log: $logFile"
