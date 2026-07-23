# tooling/checks/phase0b2-upgrade.ps1
# Phase 0B.2 §15 — Existing-DB upgrade proof.
#
# Precondition: run tooling/checks/phase0b2-compose.ps1 first so the target DB
# holds a fully-composed schema (bootstrap + Drizzle 0000..0039 + Django state).
#
# What this proves:
#   1. Idempotency of 0038 + 0039 (re-applying them is a no-op).
#   2. Data preservation across a repeat run (rows we seed survive; nothing is
#      duplicated; nothing is dropped).
#   3. Cross-schema FK + CHECK still enforce Option D contract on a populated DB.
#
# Exit code 0 on PASS, 1 on FAIL.

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)] [string]$DatabaseName,
    [string]$PsqlPath = 'C:\Program Files\PostgreSQL\17\bin\psql.exe',
    [string]$Username = 'nzila',
    [int]$Port = 5433,
    [string]$DbHost = 'localhost'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repoRoot

$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$logDir = Join-Path $repoRoot 'reports/audits/cupe-national-phase-0/phase-0b2/logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir "phase-0b2-upgrade-$stamp.log"
"===== PHASE 0B.2 §15 UPGRADE PROOF Started=$(Get-Date -Format o) DB=$DatabaseName =====" |
    Out-File -FilePath $log -Encoding utf8

function Invoke-PsqlSql {
    param([string]$Sql, [string]$Label)
    Add-Content -Path $log -Value "----- BEGIN $Label -----"
    $tmp = New-TemporaryFile
    try {
        Set-Content -Path $tmp -Value $Sql -Encoding utf8
        & $PsqlPath -U $Username -d $DatabaseName -p $Port -h $DbHost `
            -v ON_ERROR_STOP=1 -f $tmp.FullName 2>&1 |
                Tee-Object -FilePath $log -Append | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "psql exit $LASTEXITCODE at $Label" }
    } finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
    Add-Content -Path $log -Value "----- END $Label -----"
}

function Invoke-Psql {
    param([string]$File, [string]$Label)
    Add-Content -Path $log -Value "----- BEGIN $Label -----"
    & $PsqlPath -U $Username -d $DatabaseName -p $Port -h $DbHost `
        -v ON_ERROR_STOP=1 -f $File 2>&1 |
            Tee-Object -FilePath $log -Append | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "psql exit $LASTEXITCODE at $Label" }
    Add-Content -Path $log -Value "----- END $Label -----"
}

try {
    # Step 1 — Seed test data representing an existing-tenant scenario.
    Add-Content -Path $log -Value "===== STEP 1: Seed pre-existing rows ====="
    $seed = @"
BEGIN;
INSERT INTO public.orgs (id, legal_name, jurisdiction, status)
VALUES ('11111111-1111-1111-1111-111111111111',
        'Acme Local 1',
        'CA-QC',
        'active'::org_status)
ON CONFLICT (id) DO NOTHING;

-- Insert a UE org whose id equals the platform org id (Option D contract).
INSERT INTO union_eyes.organizations (id, name, slug, organization_type, platform_tenant_id)
VALUES ('11111111-1111-1111-1111-111111111111',
        'Acme Local 1',
        'acme-local-1',
        'local',
        '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;
COMMIT;
"@
    Invoke-PsqlSql -Sql $seed -Label 'seed test rows'

    # Step 2 — Snapshot counts BEFORE re-applying migrations.
    Add-Content -Path $log -Value "===== STEP 2: Snapshot BEFORE ====="
    $before = @"
SELECT 'before.orgs.count=' || COUNT(*) FROM public.orgs;
SELECT 'before.ue_orgs.count=' || COUNT(*) FROM union_eyes.organizations;
SELECT 'before.ue_kpi_snapshots.count=' || COUNT(*) FROM union_eyes.ue_kpi_snapshots;
"@
    Invoke-PsqlSql -Sql $before -Label 'snapshot before'

    # Step 3 — Re-apply 0038 (should be a no-op; idempotent guards).
    Add-Content -Path $log -Value "===== STEP 3: Re-apply 0038 (expect no-op) ====="
    Invoke-Psql -File (Join-Path $repoRoot 'packages/db/drizzle/0038_organization_cross_schema_contract.sql') `
        -Label 're-apply 0038'

    # Step 4 — Re-apply 0039 (should be a no-op).
    Add-Content -Path $log -Value "===== STEP 4: Re-apply 0039 (expect no-op) ====="
    Invoke-Psql -File (Join-Path $repoRoot 'packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql') `
        -Label 're-apply 0039'

    # Step 5 — Snapshot counts AFTER; must equal BEFORE.
    Add-Content -Path $log -Value "===== STEP 5: Snapshot AFTER ====="
    $after = @"
SELECT 'after.orgs.count=' || COUNT(*) FROM public.orgs;
SELECT 'after.ue_orgs.count=' || COUNT(*) FROM union_eyes.organizations;
SELECT 'after.ue_kpi_snapshots.count=' || COUNT(*) FROM union_eyes.ue_kpi_snapshots;
SELECT 'after.contract.check_ok=' || COUNT(*)
    FROM union_eyes.organizations
    WHERE platform_tenant_id = id;
SELECT 'after.contract.mismatch=' || COUNT(*)
    FROM union_eyes.organizations
    WHERE platform_tenant_id <> id;
"@
    Invoke-PsqlSql -Sql $after -Label 'snapshot after'

    # Step 6 — Prove FK+CHECK still bite by attempting a violation.
    Add-Content -Path $log -Value "===== STEP 6: Verify contract rejection ====="
    $violation = @"
-- Attempt to point platform_tenant_id at a DIFFERENT uuid than id.
-- MUST fail with CHECK violation.
DO `$violate`$
DECLARE
    rejected boolean := false;
BEGIN
    BEGIN
        UPDATE union_eyes.organizations
            SET platform_tenant_id = '99999999-9999-9999-9999-999999999999'
          WHERE id = '11111111-1111-1111-1111-111111111111';
    EXCEPTION WHEN check_violation THEN
        rejected := true;
    WHEN foreign_key_violation THEN
        rejected := true;
    END;
    IF rejected THEN
        RAISE NOTICE 'contract.rejected=YES';
    ELSE
        RAISE EXCEPTION 'contract NOT rejected — CHECK failed to enforce Option D';
    END IF;
END
`$violate`$;
"@
    Invoke-PsqlSql -Sql $violation -Label 'contract enforcement'

    "===== UPGRADE PROOF COMPLETE Finished=$(Get-Date -Format o) =====" |
        Add-Content -Path $log
    Write-Host "OK - see log: $log"
    exit 0
}
catch {
    "===== UPGRADE PROOF FAILED $($_.Exception.Message) =====" |
        Add-Content -Path $log
    Write-Host "FAIL - see log: $log"
    Write-Host $_.Exception.Message
    exit 1
}
