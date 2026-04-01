# =====================================================================
# replay.ps1 — Union Eyes DB Replay Script
# =====================================================================
# Full replay from scratch: drop → create → migrate → seed → validate
#
# Usage:
#   cd apps\union-eyes
#   .\db\replay.ps1                     # default: nzila_automation on port 5433
#   .\db\replay.ps1 -DbName mydb       # custom database name
#   .\db\replay.ps1 -SkipDrop           # skip drop+create, just migrate+seed
#
# Prerequisites:
#   - PostgreSQL 17 installed at C:\Program Files\PostgreSQL\17
#   - Native PG running on port 5433 (NOT the Docker container)
# =====================================================================

param(
    [string]$DbName   = "nzila_automation",
    [string]$DbUser   = "nzila",
    [string]$DbPass   = "nzila_dev",
    [string]$DbHost   = "localhost",
    [int]   $DbPort   = 5433,
    [switch]$SkipDrop,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# ── Paths ──────────────────────────────────────────────────────────────
$psqlExe   = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$seedsDir  = Join-Path $scriptDir "seeds"
$masterSeed = Join-Path $seedsDir "seed-master.sql"

# Supplementary seeds (run after master, in order)
$supplementarySeeds = @(
    "seed-cape-l123-buildup.sql",
    "seed-voting-l123.sql",
    "seed-pension-employment.sql",
    "seed-contributions-dues.sql",
    "seed-national-cbas.sql",
    "seed-claims-cba-ext.sql",
    "seed-grievance-lifecycle.sql",
    "seed-members-structures.sql",
    "seed-calendar-comms.sql",
    "seed-finance-billing.sql",
    "seed-governance-federation.sql",
    "seed-ai-safety-misc.sql",
    "seed-integrations-ext.sql",
    "seed-remaining-coverage.sql"
)

# ── Validate prerequisites ─────────────────────────────────────────────
if (-not (Test-Path $psqlExe)) {
    Write-Error "psql not found at $psqlExe — install PostgreSQL 17 or adjust path"
    exit 1
}
if (-not (Test-Path $masterSeed)) {
    Write-Error "Master seed not found at $masterSeed"
    exit 1
}

# ── Helper: run psql ───────────────────────────────────────────────────
function Invoke-Psql {
    param(
        [string]$Database,
        [string]$Command,
        [string]$File
    )
    $env:PGPASSWORD = $DbPass
    $env:PGCLIENTENCODING = "UTF8"
    $env:PAGER = ""  # Prevent 'cat is not recognized' on Windows
    $args_ = @("-U", $DbUser, "-h", $DbHost, "-p", $DbPort, "-d", $Database, "-v", "ON_ERROR_STOP=1", "--pset", "pager=off")
    if ($File) {
        $args_ += @("-f", $File)
    } else {
        $args_ += @("-c", $Command)
    }
    if ($DryRun) {
        Write-Host "[DRY RUN] psql $($args_ -join ' ')" -ForegroundColor DarkGray
        return
    }
    & $psqlExe @args_ 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "psql command failed (exit code $LASTEXITCODE)"
    }
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Union Eyes — Database Replay                              ║" -ForegroundColor Cyan
Write-Host "║  Database: $DbName on ${DbHost}:${DbPort}                 ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ══════════════════════════════════════════════════════════════════════
# Step 1: Drop and recreate database
# ══════════════════════════════════════════════════════════════════════
if (-not $SkipDrop) {
    Write-Host "[1/5] Dropping and recreating database..." -ForegroundColor Yellow

    # Terminate existing connections
    $env:PGPASSWORD = $DbPass
    & $psqlExe -U $DbUser -h $DbHost -p $DbPort -d postgres -c @"
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$DbName' AND pid <> pg_backend_pid();
"@ 2>&1 | Out-Null

    if (-not $DryRun) {
        & $psqlExe -U $DbUser -h $DbHost -p $DbPort -d postgres -c "DROP DATABASE IF EXISTS $DbName;" 2>&1
        & $psqlExe -U $DbUser -h $DbHost -p $DbPort -d postgres -c "CREATE DATABASE $DbName OWNER $DbUser;" 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Failed to create database $DbName" }
    } else {
        Write-Host "[DRY RUN] DROP DATABASE IF EXISTS $DbName; CREATE DATABASE $DbName OWNER $DbUser;" -ForegroundColor DarkGray
    }

    Write-Host "  -> Database recreated" -ForegroundColor Green
} else {
    Write-Host "[1/5] Skipping drop (--SkipDrop)" -ForegroundColor DarkGray
}

# ══════════════════════════════════════════════════════════════════════
# Step 2: Create schemas (user_management must exist before migrations)
# ══════════════════════════════════════════════════════════════════════
Write-Host "[2/5] Creating prerequisite schemas..." -ForegroundColor Yellow
Invoke-Psql -Database $DbName -Command "CREATE SCHEMA IF NOT EXISTS user_management;"
Write-Host "  -> Schemas ready" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════════
# Step 3: Apply schema via audit migration + supplementary DDL
# ══════════════════════════════════════════════════════════════════════
Write-Host "[3/5] Applying schema (audit migration + dues_rates)..." -ForegroundColor Yellow

$auditMigration = Join-Path $scriptDir "migrations-audit" "0000_familiar_silhouette.sql"

if (-not (Test-Path $auditMigration)) {
    throw "Audit migration not found at $auditMigration"
}

if (-not $DryRun) {
    Write-Host "  -> Applying migrations-audit/0000_familiar_silhouette.sql..." -ForegroundColor White
    # This 13K-line file creates ~155 tables; some non-critical enum/vector errors are expected
    $env:PGPASSWORD = $DbPass
    Get-Content $auditMigration | & $psqlExe -U $DbUser -h $DbHost -p $DbPort -d $DbName 2>&1 | Out-Null

    # Create dues_rates table (not included in the audit migration)
    Write-Host "  -> Creating dues_rates table..." -ForegroundColor White
    Invoke-Psql -Database $DbName -Command @"
CREATE TABLE IF NOT EXISTS dues_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid,
    local_id uuid,
    unit_id uuid,
    rate_name text NOT NULL,
    rate_type text NOT NULL,
    amount decimal(12,2) NOT NULL,
    effective_from timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
"@
} else {
    Write-Host "[DRY RUN] Apply audit migration + CREATE TABLE dues_rates" -ForegroundColor DarkGray
}
Write-Host "  -> Schema applied" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════════
# Step 4: Run master seed + supplementary seeds
# ══════════════════════════════════════════════════════════════════════
Write-Host "[4/5] Seeding database..." -ForegroundColor Yellow

# Master seed
Write-Host "  -> Running seed-master.sql..." -ForegroundColor White
Invoke-Psql -Database $DbName -File $masterSeed

# Supplementary seeds (optional — skip if file missing or errors)
foreach ($seed in $supplementarySeeds) {
    $seedPath = Join-Path $seedsDir $seed
    if (Test-Path $seedPath) {
        Write-Host "  -> Running $seed..." -ForegroundColor White
        try {
            Invoke-Psql -Database $DbName -File $seedPath
        } catch {
            Write-Warning "  -> $seed had errors (non-blocking): $_"
        }
    } else {
        Write-Host "  -> Skipping $seed (not found)" -ForegroundColor DarkGray
    }
}
Write-Host "  -> Seeding complete" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════════
# Step 5: Validate
# ══════════════════════════════════════════════════════════════════════
Write-Host "[5/5] Validating..." -ForegroundColor Yellow

$validationQuery = @"
SELECT '--- CORE ORGANIZATIONS ---' AS section;
SELECT slug, display_name, organization_type, hierarchy_level,
       CASE WHEN clerk_organization_id IS NOT NULL THEN 'YES' ELSE 'no' END AS has_clerk_id,
       status
FROM organizations
WHERE slug IN ('default', 'clc', 'cape-acep', 'cupe', 'cupe-local-123')
ORDER BY hierarchy_level, slug;

SELECT '--- HIERARCHY ---' AS section;
SELECT organization_type, count(*) AS count
FROM organizations
GROUP BY organization_type
ORDER BY count DESC;

SELECT '--- MEMBER COUNTS ---' AS section;
SELECT o.slug, o.display_name, count(om.user_id) AS member_count
FROM organizations o
LEFT JOIN organization_members om ON om.organization_id = o.id::text
WHERE o.slug IN ('default', 'clc', 'cape-acep', 'cupe', 'cupe-local-123')
GROUP BY o.slug, o.display_name
ORDER BY o.slug;

SELECT '--- PARENT CHAIN: CUPE L123 ---' AS section;
SELECT o.slug, o.display_name, p.slug AS parent_slug, p.display_name AS parent_name
FROM organizations o
LEFT JOIN organizations p ON o.parent_id = p.id
WHERE o.slug = 'cupe-local-123';

SELECT '--- DATA COUNTS ---' AS section;
SELECT 'grievances' AS entity, count(*) AS total FROM grievances
UNION ALL SELECT 'collective_agreements', count(*) FROM collective_agreements
UNION ALL SELECT 'user_management.users', count(*) FROM user_management.users
UNION ALL SELECT 'dues_rates', count(*) FROM dues_rates
UNION ALL SELECT 'clc_chart_of_accounts', count(*) FROM clc_chart_of_accounts;
"@

Invoke-Psql -Database $DbName -Command $validationQuery

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Replay complete!                                          ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
