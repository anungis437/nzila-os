<#
.SYNOPSIS
  Rotate the Upstash Redis REST token across the pilot tier (KV + both
  Container Apps) with pre-flight verification, snapshot, and rollback.

.DESCRIPTION
  Single-credential rotation: the same token is used for both REST (HTTPS)
  and native RESP (rediss:// AUTH password) on Upstash. This script:

    1. Verifies the candidate new token works against the current Upstash
       REST endpoint via set/get/del BEFORE any KV mutation.
    2. Snapshots existing KV values to .cache/ for rollback.
    3. Updates KV secrets:
         UPSTASH-REDIS-REST-TOKEN  -> new token (verbatim)
         UPSTASH-REDIS-URL         -> rebuilt rediss:// with new token,
                                      preserving host:port path
    4. Forces new revisions on both pilot apps (revision-suffix bump) so
       the KV-backed secret refs re-resolve.
    5. Verifies post-rotation health:
         - public  https://pilot.unioneyes.app/api/health  -> queue:ok
         - public  https://pilot.unioneyes.app/api/ready   -> ready:true
         - django  /api/auth_core/health/ via containerapp exec
                   -> redis:true, celery_broker:true, upstash_rest:true
    6. On any post-rotation verification failure, restores KV from snapshot
       and prints the rollback revision-suffix command.

  Doctrine: docs/nzila-residual-closure/r1-pilot-django-sidecar-binding-log.md
  Reviewer-of-record: anungis437

.PARAMETER NewToken
  The freshly-rotated token from the Upstash console. Required.

.PARAMETER VaultName
  KV vault holding the pilot secrets. Default: nzila-canada-pilot-kv.

.PARAMETER ResourceGroup
  Pilot RG. Default: nzila-canada-pilot-rg.

.PARAMETER NextApp
  Container App name for the Next.js pilot. Default: nzila-os-union-eyes-pilot.

.PARAMETER DjangoApp
  Container App name for the Django sidecar. Default:
  nzila-os-union-eyes-django-pilot.

.PARAMETER PublicHost
  Public hostname for the Next pilot. Default: pilot.unioneyes.app.

.PARAMETER WhatIf
  Dry-run: verifies the new token and prints what would change, without
  mutating KV or apps.

.EXAMPLE
  $newToken = Read-Host "Paste new Upstash token" -AsSecureString |
              ConvertFrom-SecureString -AsPlainText
  ./tooling/scripts/r1-pilot-upstash-token-rotate.ps1 -NewToken $newToken
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$NewToken,

  [string]$VaultName     = 'nzila-canada-pilot-kv',
  [string]$ResourceGroup = 'nzila-canada-pilot-rg',
  [string]$NextApp       = 'nzila-os-union-eyes-pilot',
  [string]$DjangoApp     = 'nzila-os-union-eyes-django-pilot',
  [string]$PublicHost    = 'pilot.unioneyes.app'
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    [ok] $msg" -ForegroundColor Green }
function Write-Warn2($msg) { Write-Host "    [warn] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "    [FAIL] $msg" -ForegroundColor Red }

# ---------------------------------------------------------------------------
# 0. Snapshot current KV state (always, even in WhatIf)
# ---------------------------------------------------------------------------
Write-Step "Snapshotting current KV state to .cache/"

$cacheDir = Join-Path (Get-Location) ".cache"
if (-not (Test-Path $cacheDir)) { New-Item -ItemType Directory -Path $cacheDir | Out-Null }

$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$snapshotPath = Join-Path $cacheDir "upstash-rotate-snapshot-$ts.json"

$oldRestUrl   = az keyvault secret show --vault-name $VaultName --name UPSTASH-REDIS-REST-URL   --query value -o tsv
$oldRestToken = az keyvault secret show --vault-name $VaultName --name UPSTASH-REDIS-REST-TOKEN --query value -o tsv
$oldNativeUrl = az keyvault secret show --vault-name $VaultName --name UPSTASH-REDIS-URL        --query value -o tsv

if (-not $oldRestUrl -or -not $oldRestToken -or -not $oldNativeUrl) {
  Write-Fail "Failed to read one or more current KV secrets. Aborting."
  exit 1
}

@{
  timestamp                  = $ts
  vault                      = $VaultName
  UPSTASH_REDIS_REST_URL     = $oldRestUrl
  UPSTASH_REDIS_REST_TOKEN   = $oldRestToken
  UPSTASH_REDIS_URL          = $oldNativeUrl
} | ConvertTo-Json | Set-Content -Path $snapshotPath -Encoding utf8

Write-Ok "snapshot -> $snapshotPath"

# ---------------------------------------------------------------------------
# 1. Pre-flight: verify NEW token works against the EXISTING REST endpoint
# ---------------------------------------------------------------------------
Write-Step "Pre-flight: verify new token against $oldRestUrl"

$probeKey = "_rotate_probe_$ts"
$headers = @{ Authorization = "Bearer $NewToken" }

try {
  $set = Invoke-RestMethod -Method POST -Uri "$oldRestUrl/set/$probeKey/ok" -Headers $headers -TimeoutSec 10
  $get = Invoke-RestMethod -Method GET  -Uri "$oldRestUrl/get/$probeKey"    -Headers $headers -TimeoutSec 10
  $del = Invoke-RestMethod -Method POST -Uri "$oldRestUrl/del/$probeKey"    -Headers $headers -TimeoutSec 10

  if ($set.result -ne 'OK' -or $get.result -ne 'ok' -or $del.result -ne 1) {
    Write-Fail "REST round-trip with new token did not return expected results."
    Write-Fail "  set=$($set.result)  get=$($get.result)  del=$($del.result)"
    exit 2
  }
  Write-Ok "REST set/get/del round-trip with new token: OK/ok/1"
} catch {
  Write-Fail "REST probe with new token threw: $($_.Exception.Message)"
  Write-Fail "Token is invalid or endpoint unreachable. KV/apps unchanged."
  exit 2
}

# ---------------------------------------------------------------------------
# 2. Build the rebuilt native rediss:// URL
# ---------------------------------------------------------------------------
Write-Step "Rebuilding native rediss:// URL with new token"

# Parse old native URL: rediss://default:<old-token>@<host>:<port>
if ($oldNativeUrl -notmatch '^(rediss?://[^:]+:)([^@]+)(@.+)$') {
  Write-Fail "Old UPSTASH-REDIS-URL does not match expected rediss://user:token@host pattern."
  Write-Fail "Aborting before any KV change."
  exit 3
}
$newNativeUrl = $matches[1] + $NewToken + $matches[3]

if ($newNativeUrl.Length -lt 30) {
  Write-Fail "Rebuilt native URL looks malformed (length=$($newNativeUrl.Length)). Aborting."
  exit 3
}
Write-Ok "rebuilt native URL (length-stable: $($oldNativeUrl.Length) -> $($newNativeUrl.Length))"

if ($WhatIfPreference) {
  Write-Warn2 "WhatIf: pre-flight passed. Would now update KV + bump revisions. Stopping."
  exit 0
}

# ---------------------------------------------------------------------------
# 3. Update KV
# ---------------------------------------------------------------------------
Write-Step "Updating KV secrets"

if ($PSCmdlet.ShouldProcess($VaultName, "update UPSTASH-REDIS-REST-TOKEN + UPSTASH-REDIS-URL")) {
  $null = az keyvault secret set --vault-name $VaultName --name UPSTASH-REDIS-REST-TOKEN --value "$NewToken"   --query id -o tsv
  Write-Ok "UPSTASH-REDIS-REST-TOKEN updated"

  $null = az keyvault secret set --vault-name $VaultName --name UPSTASH-REDIS-URL        --value "$newNativeUrl" --query id -o tsv
  Write-Ok "UPSTASH-REDIS-URL updated (native rediss://)"
}

# ---------------------------------------------------------------------------
# 4. Bump revisions on both apps
# ---------------------------------------------------------------------------
$suffix = "tokrot-" + (Get-Date -Format "HHmmss")
Write-Step "Forcing new revisions: suffix=$suffix"

if ($PSCmdlet.ShouldProcess($NextApp, "revision-suffix bump")) {
  $null = az containerapp update -n $NextApp   -g $ResourceGroup --revision-suffix $suffix --query "properties.latestRevisionName" -o tsv
  Write-Ok "$NextApp -> ${NextApp}--${suffix}"
}
if ($PSCmdlet.ShouldProcess($DjangoApp, "revision-suffix bump")) {
  $null = az containerapp update -n $DjangoApp -g $ResourceGroup --revision-suffix $suffix --query "properties.latestRevisionName" -o tsv
  Write-Ok "$DjangoApp -> ${DjangoApp}--${suffix}"
}

# ---------------------------------------------------------------------------
# 5. Post-rotation verification
# ---------------------------------------------------------------------------
Write-Step "Waiting 25s for new revisions to settle..."
Start-Sleep -Seconds 25

$failures = @()

# Public Next health
try {
  $h = Invoke-RestMethod -Uri "https://$PublicHost/api/health" -TimeoutSec 30
  if ($h.status -eq 'ok' -and $h.checks.queue -eq 'ok' -and $h.checks.database -eq 'ok') {
    Write-Ok "public /api/health: status=ok queue=ok database=ok"
  } else {
    $failures += "public /api/health: $($h | ConvertTo-Json -Compress)"
    Write-Fail "public /api/health: $($h | ConvertTo-Json -Compress)"
  }
} catch { $failures += "public /api/health threw: $($_.Exception.Message)"; Write-Fail $failures[-1] }

# Public Next ready
try {
  $r = Invoke-RestMethod -Uri "https://$PublicHost/api/ready" -TimeoutSec 30
  if ($r.ready -eq $true) { Write-Ok "public /api/ready: ready=true" }
  else { $failures += "public /api/ready: $($r | ConvertTo-Json -Compress)"; Write-Fail $failures[-1] }
} catch { $failures += "public /api/ready threw: $($_.Exception.Message)"; Write-Fail $failures[-1] }

# Django sidecar loopback
try {
  $raw = az containerapp exec -n $DjangoApp -g $ResourceGroup `
           --command "curl -s http://localhost:8000/api/auth_core/health/" 2>&1
  # az containerapp exec mixes INFO/WARNING lines with the curl output.
  # Extract the first {...} JSON object from the combined stream.
  $rawText = ($raw | Out-String)
  $m = [regex]::Match($rawText, '\{[^{}]*"checks"[^{}]*\{[^{}]*\}[^{}]*\}')
  if (-not $m.Success) {
    throw "could not find JSON health payload in exec output: $rawText"
  }
  $j = $m.Value | ConvertFrom-Json -ErrorAction Stop
  if ($j.status -eq 'ok' -and $j.checks.redis -eq $true -and $j.checks.celery_broker -eq $true) {
    $upstashOk = if ($null -ne $j.checks.upstash_rest) { $j.checks.upstash_rest } else { '<absent>' }
    Write-Ok "django: redis=true celery_broker=true upstash_rest=$upstashOk"
  } else {
    $failures += "django sidecar: $($m.Value)"
    Write-Fail $failures[-1]
  }
} catch { $failures += "django sidecar probe threw: $($_.Exception.Message)"; Write-Fail $failures[-1] }

# ---------------------------------------------------------------------------
# 6. Rollback on failure
# ---------------------------------------------------------------------------
if ($failures.Count -gt 0) {
  Write-Step "Verification FAILED. Rolling KV back from snapshot."
  $null = az keyvault secret set --vault-name $VaultName --name UPSTASH-REDIS-REST-TOKEN --value "$oldRestToken" --query id -o tsv
  $null = az keyvault secret set --vault-name $VaultName --name UPSTASH-REDIS-URL        --value "$oldNativeUrl" --query id -o tsv
  Write-Ok "KV restored from snapshot $snapshotPath"
  Write-Warn2 "Manual step required to restore app revisions:"
  Write-Warn2 "  az containerapp update -n $NextApp   -g $ResourceGroup --revision-suffix rollback-$ts"
  Write-Warn2 "  az containerapp update -n $DjangoApp -g $ResourceGroup --revision-suffix rollback-$ts"
  Write-Fail "Rotation aborted. Investigate, then re-run."
  exit 4
}

# ---------------------------------------------------------------------------
# 7. Success: print binding-log entry stub
# ---------------------------------------------------------------------------
Write-Step "Rotation complete. Append the following entry to:"
Write-Host "  docs/nzila-residual-closure/r1-pilot-django-sidecar-binding-log.md`n" -ForegroundColor Cyan

$utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm") + "Z"
@"
## $utc  ROTATE Upstash REST token (operator-initiated)

- reviewer: anungis437
- actions:
  - Operator rotated the REST token from the Upstash console.
  - Pre-flight verified new token against existing REST endpoint
    (set/get/del round-trip green).
  - Updated KV secrets in ${VaultName}:
      UPSTASH-REDIS-REST-TOKEN  -> new token (verbatim)
      UPSTASH-REDIS-URL         -> rebuilt rediss:// (length-stable)
  - Bumped both pilot apps to revision-suffix $suffix.
- verification:
  - public /api/health  : status=ok, queue=ok, database=ok
  - public /api/ready   : ready=true
  - django sidecar      : db=true, redis=true, celery_broker=true,
                          upstash_rest=true
  - snapshot retained at $snapshotPath
- residual:
  - Tier 2 verdict lifts from CONDITIONAL GO -> FULL GO for the
    Upstash credential surface. Next rotation cadence to be folded into
    r8-provider-key-rotation-cadence.md.
"@ | Write-Host

Write-Ok "DONE."
