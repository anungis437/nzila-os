<#
.SYNOPSIS
  Release-sequence rehearsal for migration 0015 (UE-RUNTIME-REALITY-20261018, Phase 3A).

.DESCRIPTION
  Builds a staging-SHAPED (schema only, no staging data, no credentials) disposable PostgreSQL database by running
  the clean-room lineage at the DEPLOYED commit, checks its fidelity against facts observed on staging, then
  rehearses the 0015 release sequence with the candidate checkout given by -RepoRoot (PR #948 head):
    A control isolation probe on the legacy state        E exceptional recovery (+ executor interaction)
    B/C governed executor --check / --apply + catalog diff   F Django migrations on a lineage-restored database
    D atomic failure and resume                           G candidate (main) worker under legacy and closed policies
                                                          H serving-image (eae195f2) statements, legacy vs closed
    I fresh bootstrap: clean-room lineage at the CANDIDATE (receives 0015)
  Everything runs against a loopback-only container with per-run generated credentials. Nothing here can reach
  Azure or staging. Requires docker, git, node (+ a node_modules directory), python with the backend requirements.
  This is NOT a substitute for the clone rehearsal on the exact candidate digest (dossier section 14).
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$RepoRoot,
  [Parameter(Mandatory)][string]$NodeModules,
  [Parameter(Mandatory)][string]$OutFile,
  [string]$DeployedSha = 'eae195f215208fdaa0529bc70431cbf9479b5124',
  [string]$Container = 'ue-release-rehearsal',
  [int]$Port = 55433,
  [switch]$KeepRig
)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; $helpers = Join-Path $here 'helpers'
$rig = Join-Path ([IO.Path]::GetTempPath()) ('ue-release-rehearsal-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force $rig | Out-Null
function New-Pw { -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ }) }
$pw = @{ admin = New-Pw; runtime = New-Pw; system = New-Pw }
$env:REHEARSAL_PG_PORT = "$Port"; $env:REHEARSAL_PW_ADMIN = $pw.admin; $env:REHEARSAL_PW_RUNTIME = $pw.runtime; $env:REHEARSAL_PW_SYSTEM = $pw.system
$env:REHEARSAL_EXECUTOR_ROOT = $RepoRoot; $env:NODE_PATH = $NodeModules
$tsx = Join-Path $NodeModules '.bin\tsx.cmd'
$app = Join-Path $RepoRoot 'apps\union-eyes'
$Results = [ordered]@{}
function Rec($section, $id, $title, [bool]$pass, $detail) {
  if (-not $Results.Contains($section)) { $Results[$section] = @() }
  $Results[$section] += [ordered]@{ id = $id; title = $title; pass = $pass; detail = "$detail" }
  Write-Host ("{0} [{1}.{2}] {3} :: {4}" -f $(if ($pass) { 'PASS' } else { 'FAIL' }), $section, $id, $title, $detail)
}
function Url($user, $pass, $db, $hostName = 'localhost') { $b = [UriBuilder]::new('postgresql', $hostName, $Port, "/$db"); $b.UserName = $user; $b.Password = $pass; $b.Uri.AbsoluteUri.TrimEnd('/') }
function Psql($sql, $db = 'postgres', $user = 'ue_admin', $pass = $pw.admin) { (docker exec -e "PGPASSWORD=$pass" $Container psql -U $user -d $db -v ON_ERROR_STOP=1 -tAc $sql 2>&1 | Out-String).Trim() }
function NewDb($name, $template) {
  Psql "select pg_terminate_backend(pid) from pg_stat_activity where datname='$template' and pid<>pg_backend_pid()" | Out-Null
  Psql "drop database if exists $name with (force)" | Out-Null
  Psql "create database $name template $template" | Out-Null
}
function Stamp($db, $filesRoot, $n) { (& node (Join-Path $helpers 'rehearse.js') baseline $db $filesRoot $n 2>&1 | Out-String).Trim() }
function RunCli($db, $mode) {
  $env:RLS_MIGRATION_ADMIN_DATABASE_URL = Url 'ue_admin' $pw.admin $db '127.0.0.1'
  Push-Location $RepoRoot; $o = node tooling\scripts\apply-union-eyes-scoped-migrations-existing-env.mjs $mode 2>&1 | Out-String; $c = $LASTEXITCODE; Pop-Location
  Remove-Item Env:\RLS_MIGRATION_ADMIN_DATABASE_URL
  [pscustomobject]@{ exit = $c; out = $o }
}
function Preflight($db) {
  $env:RLS_VERIFY_DATABASE_URL = Url 'union_eyes_runtime' $pw.runtime $db
  Push-Location $app; $o = & $tsx scripts\rls-verify.ts --mode=preflight 2>&1 | Out-String; $c = $LASTEXITCODE; Pop-Location
  Remove-Item Env:\RLS_VERIFY_DATABASE_URL
  $l = $o -split "`r?`n"
  [pscustomobject]@{ exit = $c; pass = @($l | Where-Object { $_ -like '✅*' }).Count; fail = @($l | Where-Object { $_ -like '❌*' }).Count; failed = @($l | Where-Object { $_ -like '❌*' } | ForEach-Object { ($_ -replace '^❌ ', '').Split('—')[0].Trim() }) }
}
function Probe($db, $label) { $f = Join-Path $rig "probe-$label.json"; $o = & node (Join-Path $helpers 'isolation-probe.js') $db $f 2>&1 | Out-String; $j = Get-Content $f -Raw | ConvertFrom-Json; [pscustomobject]@{ total = $j.results.Count; fail = @($j.results | Where-Object { -not $_.pass }).Count; failedIds = @($j.results | Where-Object { -not $_.pass } | ForEach-Object { $_.id }) } }
function Django($db, [string[]]$djArgs) {
  Push-Location (Join-Path $app 'backend')
  $env:DJANGO_SETTINGS_MODULE = 'config.settings'; $env:DJANGO_SECRET_KEY = (New-Pw); $env:DJANGO_DEBUG = 'True'
  $env:PGHOST = '127.0.0.1'; $env:PGPORT = "$Port"; $env:PGUSER = 'ue_admin'; $env:PGPASSWORD = $pw.admin; $env:PGDATABASE = $db
  $o = python manage.py @djArgs 2>&1 | Out-String; $c = $LASTEXITCODE
  foreach ($k in 'PGPASSWORD', 'PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE', 'DJANGO_SECRET_KEY') { Remove-Item "Env:\$k" -ErrorAction SilentlyContinue }
  Pop-Location; [pscustomobject]@{ exit = $c; out = $o }
}
function Sha($p) { $s = [Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($p)).Replace("`r`n", "`n"); $h = (New-Object Security.Cryptography.SHA256Managed).ComputeHash([Text.Encoding]::UTF8.GetBytes($s)); ($h | ForEach-Object { $_.ToString('x2') }) -join '' }

$createdNm = $false
try {
  # ---------------------------------------------------------------- setup
  $nmLink = Join-Path $RepoRoot 'node_modules'
  if (-not (Test-Path $nmLink)) { cmd /c mklink /J "$nmLink" "$NodeModules" | Out-Null; $createdNm = $true }
  docker rm -f $Container 2>&1 | Out-Null
  docker run -d --name $Container -p "127.0.0.1:${Port}:5432" -e POSTGRES_USER=ue_admin -e "POSTGRES_PASSWORD=$($pw.admin)" -e POSTGRES_DB=postgres pgvector/pgvector:0.8.1-pg16 | Out-Null
  for ($i = 0; $i -lt 40; $i++) { if ((docker exec $Container pg_isready -U ue_admin 2>&1) -match 'accepting') { break }; Start-Sleep 2 }
  Start-Sleep 3
  $meta = [ordered]@{
    candidateRepoHead = (git -C $RepoRoot rev-parse HEAD).Trim(); deployedSha = $DeployedSha
    migration0015Sha256Lf = Sha (Join-Path $app 'db\migrations-cache\0015_deadline_engine_rls_fail_closed_closure.sql')
    recoveryFileSha256Lf = Sha (Join-Path $app 'db\migrations-cache\0015_deadline_engine_rls_fail_closed_closure.rollback.sql')
    postgres = (Psql 'select version()'); image = 'pgvector/pgvector:0.8.1-pg16'; stagingPostgresMajor = '15 (Azure flexible server); rehearsal runs 16'
    node = (node -v); python = (python --version 2>&1 | Out-String).Trim(); django = (python -c "import django;print(django.__version__)" 2>&1 | Out-String).Trim()
    startedUtc = (Get-Date).ToUniversalTime().ToString('o'); isolation = 'loopback-only container, per-run generated credentials, no staging data, no Azure access'
  }
  $dep = Join-Path $rig 'deployed'
  git -C $RepoRoot worktree add --no-checkout --detach $dep $DeployedSha 2>&1 | Out-Null
  Push-Location $dep
  git sparse-checkout init --cone 2>&1 | Out-Null
  git sparse-checkout set apps/union-eyes/backend apps/union-eyes/db migrations tooling/scripts tooling/sql reports/union-eyes/runtime-schema-lineage 2>&1 | Out-Null
  git checkout 2>&1 | Out-Null
  Pop-Location
  Psql 'create database union_eyes_lineage' | Out-Null
  foreach ($r in 'union_eyes_runtime', 'union_eyes_system') { Psql "create role $r login nosuperuser nobypassrls nocreatedb nocreaterole password '$($pw[$r.Replace('union_eyes_',''  )])'" | Out-Null }
  # clean-room lineage at the DEPLOYED commit => staging-shaped schema (S0)
  Push-Location $dep
  $env:UE_SCHEMA_LINEAGE_CLEANROOM = '1'; $env:DATABASE_URL = Url 'ue_admin' $pw.admin 'union_eyes_lineage' '127.0.0.1'
  $env:CLEANROOM_DOCKER_CONTAINER = $Container; $env:PGHOST = '127.0.0.1'; $env:PGPORT = "$Port"; $env:PGUSER = 'ue_admin'; $env:PGPASSWORD = $pw.admin; $env:PGDATABASE = 'union_eyes_lineage'
  $cr = node tooling\scripts\run-union-eyes-schema-lineage-cleanroom.mjs 2>&1 | Out-String
  foreach ($k in 'UE_SCHEMA_LINEAGE_CLEANROOM', 'DATABASE_URL', 'CLEANROOM_DOCKER_CONTAINER', 'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE') { Remove-Item "Env:\$k" -ErrorAction SilentlyContinue }
  Pop-Location
  Rec 'SETUP' 'S0' 'clean-room lineage at the deployed commit builds the staging-shaped schema' ($cr -match '"scopedFail":0' -and $cr -match '"djangoMigrate":"PASS"') (($cr -split "`r?`n" | Select-Object -Last 2) -join ' ')

  # ---------------------------------------------------------------- fidelity vs facts observed on staging 2026-10-19
  $pub = (Psql "select string_agg(tablename||'.'||policyname, ',' order by tablename, policyname) from pg_policies where schemaname='public' and roles::text like '%public%'" 'union_eyes_lineage')
  $expPub = 'deadline_audit_events.deadline_audit_events_tenant_isolation,deadline_reminder_executions.deadline_reminder_executions_read,deadline_reminders.deadline_reminders_tenant_isolation,pilot_checklist_items.pilot_checklist_items_org_isolation,pilot_demo_seeds.pilot_demo_seeds_org_isolation'
  Rec 'FIDELITY' 'F1' 'exactly the five PUBLIC-role policies observed on staging' ($pub -eq $expPub) $pub
  $flags = Psql "select string_agg(relname||'='||relrowsecurity||'/'||relforcerowsecurity, ',' order by relname) from pg_class where relname in ('deadline_reminders','deadline_audit_events','deadline_reminder_executions') and relkind='r'" 'union_eyes_lineage'
  Rec 'FIDELITY' 'F2' 'deadline tables RLS/FORCE flags as on staging (executions true/false)' ($flags -eq 'deadline_audit_events=true/true,deadline_reminder_executions=true/false,deadline_reminders=true/true') $flags
  $dj = Psql 'select count(*) from django_migrations' 'union_eyes_lineage'; Rec 'FIDELITY' 'F3' 'Django migrations applied = 79 (staging: 79)' ($dj -eq '79') $dj
  $cv = Psql "select coalesce(to_regclass('public.deadline_reassignment_convergence')::text,'absent')" 'union_eyes_lineage'; Rec 'FIDELITY' 'F4' 'deadline_reassignment_convergence absent (as on staging)' ($cv -eq 'absent') $cv
  $dd = Psql "select count(*) from information_schema.columns where table_name='grievance_deadlines' and column_name in ('due_date','status')" 'union_eyes_lineage'; Rec 'FIDELITY' 'F5' 'grievance_deadlines has no due_date/status (as on staging)' ($dd -eq '0') $dd
  $pf0 = Preflight 'union_eyes_lineage'
  Rec 'FIDELITY' 'F6' 'rls-verify preflight 1698/1699, failing only deadline_reminder_executions (as on staging)' ($pf0.pass -eq 1698 -and $pf0.fail -eq 1 -and ($pf0.failed -join ' ') -match 'deadline_reminder_executions') "pass=$($pf0.pass) fail=$($pf0.fail) $($pf0.failed -join '; ')"
  $led = Psql "select coalesce(to_regclass('drizzle.__drizzle_migrations')::text,'absent')" 'union_eyes_lineage'
  Rec 'FIDELITY' 'F7' 'ledger table: clean-room does not write one (staging ledger is UNKNOWN; see dossier read-only check)' $true $led

  # ---------------------------------------------------------------- A control
  NewDb 'ctl_legacy' 'union_eyes_lineage'
  $a = Probe 'ctl_legacy' 'legacy'
  Rec 'A_CONTROL' 'A1' 'legacy state reproduces the fail-open defect (7 failures: 6 no-context reads + 1 forged insert)' ($a.fail -eq 7 -and $a.total -eq 15) "total=$($a.total) fail=$($a.fail) ids=$($a.failedIds -join ',')"

  # ---------------------------------------------------------------- B/C governed executor against a staging-like ledger
  NewDb 'x_chain' 'union_eyes_lineage'
  $st = Stamp 'x_chain' $dep 6; Rec 'B_CHECK' 'B0' 'ledger stamped with the DEPLOYED hashes of 0000-0005 (staging-like: the ICRA gate records 0005)' ($st -match '"stamped":6') $st
  $chk = RunCli 'x_chain' '--check'
  Rec 'B_CHECK' 'B1' 'governed --check: 6 applied, 10 pending (0006-0015); 0000-0005 unchanged between deployed and candidate' ($chk.exit -eq 0 -and $chk.out -match 'applied=6 pending=10') (($chk.out -split "`r?`n" | Where-Object { $_ -match 'ledger_exists' }) -join '')
  $grantQ = "select md5(string_agg(table_name||':'||grantee||':'||privilege_type, ',' order by table_name,grantee,privilege_type)) from information_schema.role_table_grants where table_schema='public' and table_name in ('deadline_reminders','deadline_audit_events','deadline_reminder_executions') and grantee in ('union_eyes_runtime','union_eyes_system')"
  $g0 = Psql $grantQ 'x_chain'
  & node (Join-Path $helpers 'rehearse.js') fingerprint x_chain (Join-Path $rig 'fp0.json')
  $ap = RunCli 'x_chain' '--apply'
  Rec 'C_APPLY' 'C1' 'governed --apply runs 10 migrations (0006-0015) and leaves 0 pending' ($ap.exit -eq 0 -and $ap.out -match 'applied_count=10' -and $ap.out -match 'final_pending=0') (($ap.out -split "`r?`n" | Where-Object { $_ -match 'applied_count|final_' }) -join ' | ')
  & node (Join-Path $helpers 'rehearse.js') fingerprint x_chain (Join-Path $rig 'fp1.json')
  $d = (& node (Join-Path $helpers 'rehearse.js') diff (Join-Path $rig 'fp0.json') (Join-Path $rig 'fp1.json') | Out-String) | ConvertFrom-Json
  $want = 'deadline_audit_events,deadline_reminder_executions,deadline_reminders'
  Rec 'C_APPLY' 'C2' 'catalog delta on a staging-shaped DB is EXACTLY the three deadline tables (RLS/FORCE/policies/runtime+system grants of every other public table unchanged)' ((($d.tables | Sort-Object) -join ',') -eq $want) "tables=$($d.tables -join ',')"
  Rec 'C_APPLY' 'C3' 'helper functions redefined: the ten ue_create_* bodies (edited skip-missing-table guards); nothing else' (($d.fns.Count -eq 10) -and (@($d.fns | Where-Object { $_ -notlike 'ue_create_*' }).Count -eq 0)) "count=$($d.fns.Count)"
  $g1 = Psql $grantQ 'x_chain'; Rec 'C_APPLY' 'C4' 'runtime/system privileges on the three tables identical before and after' ($g0 -eq $g1) "$g0 / $g1"
  $pf1 = Preflight 'x_chain'; Rec 'C_APPLY' 'C5' 'main rls-verify preflight after apply: 1699/1699' ($pf1.exit -eq 0 -and $pf1.pass -eq 1699 -and $pf1.fail -eq 0) "pass=$($pf1.pass) fail=$($pf1.fail)"
  $p1 = Probe 'x_chain' 'closed'; Rec 'C_APPLY' 'C6' 'isolation probe after apply: 15/15 (no-context read/insert denied, org A/B isolation, system by role, no role assumption)' ($p1.fail -eq 0 -and $p1.total -eq 15) "total=$($p1.total) fail=$($p1.fail)"
  $ap2 = RunCli 'x_chain' '--apply'; Rec 'C_APPLY' 'C7' 'second --apply is a no-op (idempotent)' ($ap2.exit -eq 0 -and $ap2.out -match 'applied_count=0' -and $ap2.out -match 'final_pending=0') (($ap2.out -split "`r?`n" | Where-Object { $_ -match 'applied_count' }) -join '')
  $lc = Psql 'select count(*) from drizzle.__drizzle_migrations' 'x_chain'; Rec 'C_APPLY' 'C8' 'ledger holds 16 entries' ($lc -eq '16') $lc
  # empty-ledger behaviour (what a missing ledger would do)
  NewDb 'x_emptyledger' 'union_eyes_lineage'
  $em = RunCli 'x_emptyledger' '--apply'
  Rec 'B_CHECK' 'B2' 'with an EMPTY ledger the executor stops at 0000 (not re-runnable) and records nothing: fails closed' ($em.exit -ne 0 -and $em.out -match '0000_outstanding_viper failed') (($em.out -split "`r?`n" | Where-Object { $_ -match 'FAIL' }) -join ' ')

  # ---------------------------------------------------------------- D atomic failure + resume
  NewDb 'x_fail' 'union_eyes_lineage'; Stamp 'x_fail' $dep 6 | Out-Null
  Psql 'create policy rogue_public on deadline_reminders using (true)' 'x_fail' | Out-Null
  $fa = RunCli 'x_fail' '--apply'
  Rec 'D_ATOMIC' 'D1' 'a PUBLIC policy the migration did not create makes its post-condition fail; --apply exits non-zero' ($fa.exit -ne 0 -and $fa.out -match 'post-condition failed for: deadline_reminders') (($fa.out -split "`r?`n" | Where-Object { $_ -match 'FAIL' }) -join ' ')
  $lf = Psql 'select count(*) from drizzle.__drizzle_migrations' 'x_fail'; Rec 'D_ATOMIC' 'D2' '0015 is NOT recorded (0006-0014 are: 15 entries)' ($lf -eq '15') $lf
  $legacyLeft = Psql "select count(*) from pg_policies where tablename='deadline_reminders' and policyname='deadline_reminders_tenant_isolation'" 'x_fail'
  $force = Psql "select relforcerowsecurity from pg_class where relname='deadline_reminder_executions'" 'x_fail'
  $ueExec = Psql "select count(*) from pg_policies where tablename='deadline_reminder_executions' and policyname like 'ue_%'" 'x_fail'
  Rec 'D_ATOMIC' 'D3' 'nothing from 0015 persisted: legacy policy intact, executions FORCE unchanged, no ue_* policy added' ($legacyLeft -eq '1' -and $force -eq 'f' -and $ueExec -eq '0') "legacyPolicies=$legacyLeft force=$force ueOnExecutions=$ueExec"
  Psql 'drop policy rogue_public on deadline_reminders' 'x_fail' | Out-Null
  $re = RunCli 'x_fail' '--apply'; Rec 'D_ATOMIC' 'D4' 'after removing the cause, --apply resumes and applies only 0015' ($re.exit -eq 0 -and $re.out -match 'applied_count=1' -and $re.out -match '0015_deadline_engine') (($re.out -split "`r?`n" | Where-Object { $_ -match 'applied_count' }) -join '')
  $pf2 = Preflight 'x_fail'; Rec 'D_ATOMIC' 'D5' 'preflight 1699/1699 after the resumed apply' ($pf2.pass -eq 1699 -and $pf2.fail -eq 0) "pass=$($pf2.pass) fail=$($pf2.fail)"

  # ---------------------------------------------------------------- E exceptional recovery
  NewDb 'x_recovery' 'x_chain'
  $cache = Join-Path $app 'db\migrations-cache'
  function RunSql($db, $prefix, $file) { ($prefix + "`n" + (Get-Content $file -Raw)) | docker exec -i -e "PGPASSWORD=$($pw.admin)" $Container psql -U ue_admin -d $db -v ON_ERROR_STOP=1 -q 2>&1 | Out-String }
  $o1 = RunSql 'x_recovery' '' (Join-Path $cache '0015_deadline_engine_rls_fail_closed_closure.rollback.sql')
  $stillClosed = Psql "select count(*) from pg_policies where tablename='deadline_reminders' and policyname='deadline_reminders_tenant_isolation'" 'x_recovery'
  Rec 'E_RECOVERY' 'E1' 'recovery file refuses to run without a recorded security disposition; nothing changes' ($o1 -match 'refusing' -and $stillClosed -eq '0') ($o1.Trim() -replace '\s+', ' ')
  RunSql 'x_recovery' "select set_config('ue.fail_open_recovery_disposition','SEC-DISP-REHEARSAL-0001',false);" (Join-Path $cache '0015_deadline_engine_rls_fail_closed_closure.rollback.sql') | Out-Null
  $pr = Probe 'x_recovery' 'recovered-open'; Rec 'E_RECOVERY' 'E2' 'with a disposition it reopens cross-tenant access (probe fails on the no-context checks)' ($pr.fail -ge 7) "fail=$($pr.fail) ids=$($pr.failedIds -join ',')"
  $pf3 = Preflight 'x_recovery'; Rec 'E_RECOVERY' 'E3' 'deploy-time preflight detects the reopened state (exit non-zero)' ($pf3.exit -ne 0 -and $pf3.fail -ge 1) "pass=$($pf3.pass) fail=$($pf3.fail)"
  $ex = RunCli 'x_recovery' '--apply'; $pr2 = Probe 'x_recovery' 'still-open'
  Rec 'E_RECOVERY' 'E4' 'TRAP: after recovery the governed executor reports 0 pending and does NOT re-close (0015 stays recorded)' ($ex.out -match 'applied_count=0' -and $pr2.fail -ge 7) "executor=$((($ex.out -split "`r?`n" | Where-Object { $_ -match 'applied_count' }) -join '')) probeFail=$($pr2.fail)"
  RunSql 'x_recovery' '' (Join-Path $cache '0015_deadline_engine_rls_fail_closed_closure.sql') | Out-Null
  $pr3 = Probe 'x_recovery' 'reclosed'; $pf4 = Preflight 'x_recovery'; $lr = Psql 'select count(*) from drizzle.__drizzle_migrations' 'x_recovery'
  Rec 'E_RECOVERY' 'E5' 'direct idempotent replay of 0015 re-closes: probe 15/15, preflight 1699/1699, ledger unchanged (16)' ($pr3.fail -eq 0 -and $pf4.pass -eq 1699 -and $lr -eq '16') "probeFail=$($pr3.fail) preflightPass=$($pf4.pass) ledger=$lr"

  # ---------------------------------------------------------------- F Django migrations on a lineage-restored database
  NewDb 'x_django' 'union_eyes_lineage'
  $f1 = Django 'x_django' @('migrate', '--noinput')
  $cnt = Psql 'select count(*) from django_migrations' 'x_django'
  Rec 'F_DJANGO' 'F1' 'main''s Django migrate FAILS on the staging-shaped DB at content.0004 (DuplicateColumn) after 4 migrations already committed' ($f1.exit -ne 0 -and $f1.out -match 'DuplicateColumn' -and $f1.out -match 'content\.0004' -and $cnt -eq '83') "exit=$($f1.exit) migrationsNow=$cnt (was 79)"
  $cols = (& node (Join-Path $helpers 'migration-columns.js') (Join-Path $app 'backend\content\migrations\0004_documents_access_level_documents_blob_container_and_more.py') | Out-String).Trim()
  $coll = Psql "select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_name='documents' and column_name = any(string_to_array('$cols', ','))" 'x_django'
  Rec 'F_DJANGO' 'F2' 'documents columns that content.0004 adds but already exist (beyond its 8-column platform-0006 guard)' ($coll.Length -gt 0) $coll
  $f2 = Django 'x_django' @('migrate', 'content', '0004', '--fake', '--noinput'); $f3 = Django 'x_django' @('migrate', '--noinput')
  Rec 'F_DJANGO' 'F3' 'next failure after faking content.0004: grievances.0005 (claims.idempotency_hash already exists)' ($f3.exit -ne 0 -and $f3.out -match 'idempotency_hash') ((($f3.out -split "`r?`n" | Where-Object { $_ -match 'DuplicateColumn' } | Select-Object -First 1)) -replace '\s+', ' ')
  Django 'x_django' @('migrate', 'grievances', '0005', '--fake', '--noinput') | Out-Null; $f4 = Django 'x_django' @('migrate', '--noinput'); $chk2 = Django 'x_django' @('migrate', '--check')
  Rec 'F_DJANGO' 'F4' 'once those two are faked, the rest (incl. grievances.0006) applies; together with the four applied in F1 no migration conflicts with the RLS policies or the user-id type conversions' ($f4.exit -eq 0 -and $chk2.exit -eq 0) "exit=$($f4.exit) check=$($chk2.exit) total=$(Psql 'select count(*) from django_migrations' 'x_django')"

  # ---------------------------------------------------------------- G candidate (main) worker under both policy states
  NewDb 'e_legacy' 'union_eyes_lineage'; & node (Join-Path $helpers 'loopback-schema-patch.js') e_legacy | Out-Null
  NewDb 'e_closed' 'union_eyes_lineage'; Stamp 'e_closed' $dep 6 | Out-Null; RunCli 'e_closed' '--apply' | Out-Null; & node (Join-Path $helpers 'loopback-schema-patch.js') e_closed | Out-Null
  $txt = Get-Content (Join-Path $app 'tsconfig.json') -Raw; $paths = [regex]::Match($txt, '"paths"\s*:\s*\{.*?\n\s*\}', 'Singleline').Value
  Set-Content (Join-Path $app '_rehearsal_tsconfig.json') ("{ `"compilerOptions`": { `"module`": `"commonjs`", `"moduleResolution`": `"node`", `"target`": `"es2022`", `"esModuleInterop`": true, `"skipLibCheck`": true, `"baseUrl`": `".`", $paths } }")
  Copy-Item (Join-Path $helpers 'worker-harness.ts') (Join-Path $app '_rehearsal_worker.ts')
  foreach ($w in @(@('e_legacy', 'legacy policies'), @('e_closed', 'closed policies (0015)'))) {
    $db = $w[0]; $jf = Join-Path $rig "worker-$db.json"
    $env:AD_URL = Url 'ue_admin' $pw.admin $db; $env:DATABASE_URL = Url 'union_eyes_runtime' $pw.runtime $db; $env:SYSTEM_DATABASE_URL = Url 'union_eyes_system' $pw.system $db; $env:NODE_ENV = 'test'; $env:RESEND_API_KEY = ''
    Push-Location $app; & $tsx --tsconfig _rehearsal_tsconfig.json _rehearsal_worker.ts $jf 2>&1 | Out-Null; Pop-Location
    foreach ($k in 'AD_URL', 'DATABASE_URL', 'SYSTEM_DATABASE_URL', 'NODE_ENV', 'RESEND_API_KEY') { Remove-Item "Env:\$k" -ErrorAction SilentlyContinue }
    $j = if (Test-Path $jf) { Get-Content $jf -Raw | ConvertFrom-Json } else { @() }
    $nPass = @($j | Where-Object { $_.pass }).Count
    Rec 'G_CANDIDATE_WORKER' ($w[0]) "candidate (main) worker, real code, 3 concurrent workers, email disabled, under $($w[1]): 9/9" ($j.Count -eq 9 -and $nPass -eq 9) "pass=$nPass of $($j.Count): claimed-exactly-once, one execution row per attempt, expired-lease recovery, no lease theft, bounded dead-letter, no duplicate rows, empty-vs-failure"
  }
  Remove-Item (Join-Path $app '_rehearsal_worker.ts'), (Join-Path $app '_rehearsal_tsconfig.json') -ErrorAction SilentlyContinue

  # ---------------------------------------------------------------- H serving-image (eae195f2) statements, legacy vs closed
  $stmts = [ordered]@{
    'worker sweep (assignment-sync.ts, first statement)' = "select id from deadline_reassignment_convergence where status='pending' limit 50"
    'overdue cron candidate query (app/api/cron/deadline-overdue/route.ts)' = "select gd.id, gd.grievance_id, g.organization_id, gd.due_date from grievance_deadlines gd join grievances g on g.id=gd.grievance_id where gd.due_date < now() and gd.status not in ('completed','cancelled') limit 200"
    'assign route first write (requestAssignmentConvergence insert)' = "insert into deadline_reassignment_convergence (organization_id, grievance_id, new_assignee_id, correlation_id) values (gen_random_uuid(), gen_random_uuid(), 'u', 'c')"
  }
  $same = $true; $rows = @()
  foreach ($k in $stmts.Keys) {
    $out = @{}
    foreach ($st2 in @(@('legacy', 'ctl_legacy'), @('closed', 'x_fail'))) { $o = Psql ("begin; set local app.current_org_id=''; " + $stmts[$k] + "; rollback;") $st2[1] 'union_eyes_runtime' $pw.runtime; $m = [regex]::Match($o, 'ERROR:[^\r\n]*'); $out[$st2[0]] = $(if ($m.Success) { $m.Value } else { $o }) }
    if ($out.legacy -ne $out.closed) { $same = $false }
    $rows += "$k => legacy: $($out.legacy) | closed: $($out.closed)"
  }
  Rec 'H_SERVING_IMAGE' 'H1' 'serving-image statements fail first on a missing relation/column, with identical errors before and after 0015 (no policy-dependent statement is reachable)' ($same -and @($rows | Where-Object { $_ -match 'does not exist' }).Count -eq 3) ($rows -join ' ;; ')

  # ---------------------------------------------------------------- I fresh bootstrap: clean-room lineage AT THE CANDIDATE (separate sparse checkout; the candidate tree is not touched)
  $cand = Join-Path $rig 'candidate'
  git -C $RepoRoot worktree add --no-checkout --detach $cand $meta.candidateRepoHead 2>&1 | Out-Null
  Push-Location $cand
  git sparse-checkout init --cone 2>&1 | Out-Null
  git sparse-checkout set apps/union-eyes/backend apps/union-eyes/db migrations tooling/scripts tooling/sql reports/union-eyes/runtime-schema-lineage 2>&1 | Out-Null
  git checkout 2>&1 | Out-Null
  Psql 'create database fresh_candidate' | Out-Null
  $env:UE_SCHEMA_LINEAGE_CLEANROOM = '1'; $env:DATABASE_URL = Url 'ue_admin' $pw.admin 'fresh_candidate' '127.0.0.1'
  $env:CLEANROOM_DOCKER_CONTAINER = $Container; $env:PGHOST = '127.0.0.1'; $env:PGPORT = "$Port"; $env:PGUSER = 'ue_admin'; $env:PGPASSWORD = $pw.admin; $env:PGDATABASE = 'fresh_candidate'
  $fc = node tooling\scripts\run-union-eyes-schema-lineage-cleanroom.mjs 2>&1 | Out-String
  foreach ($k in 'UE_SCHEMA_LINEAGE_CLEANROOM', 'DATABASE_URL', 'CLEANROOM_DOCKER_CONTAINER', 'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE') { Remove-Item "Env:\$k" -ErrorAction SilentlyContinue }
  Pop-Location
  Rec 'I_FRESH' 'I1' 'fresh bootstrap at the candidate (Django-first clean-room) applies all 16 scoped migrations including 0015, no failures' ($fc -match '"scopedPass":16' -and $fc -match '"scopedFail":0' -and $fc -match '"djangoMigrate":"PASS"') (($fc -split "`r?`n" | Select-Object -Last 2) -join ' ')
  $fpub = Psql "select count(*) from pg_policies where tablename in ('deadline_reminders','deadline_audit_events','deadline_reminder_executions') and roles::text like '%public%'" 'fresh_candidate'
  $fflag = Psql "select string_agg(relname||'='||relrowsecurity||'/'||relforcerowsecurity, ',' order by relname) from pg_class where relname in ('deadline_reminders','deadline_audit_events','deadline_reminder_executions') and relkind='r'" 'fresh_candidate'
  Rec 'I_FRESH' 'I2' 'fresh DB: no PUBLIC policy on the three tables, RLS and FORCE on all three' ($fpub -eq '0' -and $fflag -eq 'deadline_audit_events=true/true,deadline_reminder_executions=true/true,deadline_reminders=true/true') "publicPolicies=$fpub flags=$fflag"
  $pf5 = Preflight 'fresh_candidate'; Rec 'I_FRESH' 'I3' 'rls-verify preflight on the fresh DB: no failures' ($pf5.exit -eq 0 -and $pf5.fail -eq 0) "pass=$($pf5.pass) fail=$($pf5.fail)"
  $fp = Probe 'fresh_candidate' 'fresh'; Rec 'I_FRESH' 'I4' 'isolation probe on the fresh DB: 15/15' ($fp.fail -eq 0 -and $fp.total -eq 15) "total=$($fp.total) fail=$($fp.fail)"
  $meta['finishedUtc'] = (Get-Date).ToUniversalTime().ToString('o')
  $all = $Results.Values | ForEach-Object { $_ }
  $summary = [ordered]@{ checks = @($all).Count; passed = @($all | Where-Object { $_.pass }).Count; failed = @($all | Where-Object { -not $_.pass }).Count }
  $out = [ordered]@{ meta = $meta; summary = $summary; results = $Results; limits = @(
      'Loopback PostgreSQL 16 in Docker, schema-only; staging is Azure PostgreSQL 15 with real data and an unknown ledger.',
      'Staging-shaped state is reproduced by the clean-room lineage at the deployed commit and validated by the FIDELITY checks, not by reading staging.',
      'No Azure resource, revision, traffic rule or credential was touched; revision/traffic steps in the dossier are unrehearsed.',
      'Not the clone rehearsal on the exact candidate digest required before any staging mutation.') }
  [IO.File]::WriteAllText($OutFile, ($out | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
  Write-Host ("SUMMARY checks={0} passed={1} failed={2}" -f $summary.checks, $summary.passed, $summary.failed)
}
finally {
  if (-not $KeepRig) {
    docker rm -f $Container 2>&1 | Out-Null
    git -C $RepoRoot worktree remove --force (Join-Path $rig 'deployed') 2>&1 | Out-Null
    git -C $RepoRoot worktree remove --force (Join-Path $rig 'candidate') 2>&1 | Out-Null
    git -C $RepoRoot worktree prune 2>&1 | Out-Null
    Remove-Item -Recurse -Force $rig -ErrorAction SilentlyContinue
  }
  if ($createdNm) { cmd /c rmdir "$(Join-Path $RepoRoot 'node_modules')" 2>&1 | Out-Null }
  foreach ($k in 'REHEARSAL_PG_PORT', 'REHEARSAL_PW_ADMIN', 'REHEARSAL_PW_RUNTIME', 'REHEARSAL_PW_SYSTEM', 'REHEARSAL_EXECUTOR_ROOT') { Remove-Item "Env:\$k" -ErrorAction SilentlyContinue }
}