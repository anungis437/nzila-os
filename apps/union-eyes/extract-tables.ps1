$ErrorActionPreference = "Stop"
Set-Location "c:\APPS\nzila-automation\apps\union-eyes"

Write-Host "Reading migration file..."
$content = Get-Content db/migrations-audit/0000_familiar_silhouette.sql -Raw
Write-Host "Migration file loaded: $($content.Length) chars"

# Get existing enums from DB
Write-Host "Querying existing enums from DB..."
$env:PGPASSWORD = "nzila_dev"
$existingEnums = & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U nzila -d nzila_automation -p 5433 -h localhost -t -A -c "SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname;" 2>$null
Write-Host "Existing enums: $($existingEnums.Count)"

$targetTables = @(
    'accessibility_audits','accessibility_issues','address_change_history','address_validation_cache',
    'ai_clause_reasonings','ai_copilot_sessions','ai_grievance_triages','ai_insight_reports',
    'ai_safety_filters','alert_rules','chat_messages','committee_memberships','congress_memberships',
    'contribution_rates','country_address_formats','course_sessions','document_folders','document_signers',
    'employer_risk_scores','employment_history','event_attendees','external_insurance_claims',
    'external_insurance_policies','feature_flags','governance_bylaws','holidays','insight_recommendations',
    'integration_configs','integration_sync_log','international_addresses','job_classifications',
    'knowledge_base_articles','member_employment','member_leaves','member_location_consent',
    'public_content','role_tenure_history','signature_audit_log','signature_audit_trail',
    'signature_documents','signature_verification','signature_workflows','signers','sla_policies',
    'social_analytics','steward_assignments','stewards','surveys','ticket_comments','ticket_history',
    'user_uuid_mapping','voter_eligibility','voting_audit_log','voting_options','webhook_events'
)
Write-Host "Target tables: $($targetTables.Count)"

# Get all migration enum names
$allMigrationEnums = [regex]::Matches($content, 'CREATE TYPE "public"\."([^"]+)" AS ENUM') | ForEach-Object { $_.Groups[1].Value }
Write-Host "Total enums in migration: $($allMigrationEnums.Count)"

# Extract table SQL blocks
$tableBlocks = [System.Collections.Generic.List[string]]::new()
$tableNames = [System.Collections.Generic.List[string]]::new()
$combinedTableSQL = ""
foreach ($t in $targetTables) {
    $pattern = "(?s)CREATE TABLE `"$t`" \(.*?\n\);"
    $m = [regex]::Match($content, $pattern)
    if ($m.Success) {
        $tableBlocks.Add($m.Value)
        $tableNames.Add($t)
        $combinedTableSQL += $m.Value + "`n"
    } else {
        Write-Host "TABLE NOT FOUND: $t"
    }
}
Write-Host "Tables found: $($tableBlocks.Count)"

# Find enums needed by these tables that don't exist in DB
$neededEnumNames = [System.Collections.Generic.List[string]]::new()
foreach ($e in $allMigrationEnums) {
    if ($combinedTableSQL.Contains("`"$e`"") -and ($e -notin $existingEnums)) {
        if ($e -notin $neededEnumNames) { $neededEnumNames.Add($e) }
    }
}
$neededEnumNames.Sort()
Write-Host "Enums to create: $($neededEnumNames.Count)"

# Extract CREATE TYPE blocks for needed enums
$enumBlocks = [System.Collections.Generic.List[string]]::new()
foreach ($e in $neededEnumNames) {
    $pattern = "(?s)CREATE TYPE `"public`"\.`"$e`" AS ENUM\([^)]+\);"
    $m = [regex]::Match($content, $pattern)
    if ($m.Success) {
        $enumBlocks.Add($m.Value)
    } else {
        Write-Host "WARNING: Could not extract CREATE TYPE for: $e"
    }
}
Write-Host "Enum blocks extracted: $($enumBlocks.Count)"

# Build output SQL
$sb = [System.Text.StringBuilder]::new()
$null = $sb.AppendLine("-- =============================================================================")
$null = $sb.AppendLine("-- Corrective Migration: Active Tables Missing from Database")
$null = $sb.AppendLine("-- =============================================================================")
$null = $sb.AppendLine("-- Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$null = $sb.AppendLine("-- Source: Drizzle migration 0000_familiar_silhouette.sql (519 tables)")
$null = $sb.AppendLine("-- Purpose: Create $($tableBlocks.Count) tables that are ACTIVELY referenced by")
$null = $sb.AppendLine("--          services/routes but missing from the PostgreSQL database")
$null = $sb.AppendLine("-- Skipped: 16 platform-economics tables (already created)")
$null = $sb.AppendLine("-- Not found in migration: 13 tables (ab_tests, ab_test_variants,")
$null = $sb.AppendLine("--   board_packet_distributions, board_packets, case_studies,")
$null = $sb.AppendLine("--   data_aggregation_consent, dispatch_assignments, dispatch_requests,")
$null = $sb.AppendLine("--   dispatch_rules, impact_metrics, pilot_applications, pilot_metrics,")
$null = $sb.AppendLine("--   testimonials)")
$null = $sb.AppendLine("-- =============================================================================")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("-- =============================================================================")
$null = $sb.AppendLine("-- PART 1: CREATE TYPE (enum) statements - $($enumBlocks.Count) new enum types")
$null = $sb.AppendLine("-- =============================================================================")
$null = $sb.AppendLine("")

foreach ($block in $enumBlocks) {
    $null = $sb.AppendLine("DO `$`$ BEGIN")
    $null = $sb.AppendLine("    $block")
    $null = $sb.AppendLine("EXCEPTION WHEN duplicate_object THEN NULL;")
    $null = $sb.AppendLine("END `$`$;")
    $null = $sb.AppendLine("")
}

$null = $sb.AppendLine("-- =============================================================================")
$null = $sb.AppendLine("-- PART 2: CREATE TABLE statements - $($tableBlocks.Count) active tables")
$null = $sb.AppendLine("-- =============================================================================")
$null = $sb.AppendLine("-- Note: Some tables have FK references to other tables. If those tables")
$null = $sb.AppendLine("-- don't exist yet, the FK constraint will fail. The base schema tables")
$null = $sb.AppendLine("-- should already be in place before running this migration.")
$null = $sb.AppendLine("-- =============================================================================")
$null = $sb.AppendLine("")

for ($i = 0; $i -lt $tableBlocks.Count; $i++) {
    $null = $sb.AppendLine($tableBlocks[$i])
    $null = $sb.AppendLine("--> statement-breakpoint")
}

# Write output
$outPath = "db/migrations/corrective-active-tables.sql"
$outDir = Split-Path $outPath -Parent
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

[System.IO.File]::WriteAllText((Resolve-Path $outDir | Join-Path -ChildPath "corrective-active-tables.sql"), $sb.ToString(), [System.Text.Encoding]::UTF8)
$lineCount = (Get-Content $outPath | Measure-Object -Line).Lines
Write-Host ""
Write-Host "=== RESULT ==="
Write-Host "File: $outPath"
Write-Host "Lines: $lineCount"
Write-Host "Enum types created: $($enumBlocks.Count)"
Write-Host "Tables created: $($tableBlocks.Count)"
Write-Host "Enum names: $($neededEnumNames -join ', ')"
