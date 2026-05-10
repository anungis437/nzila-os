<#
.SYNOPSIS
  R1 pilot Django sidecar — substrate preflight (read-only).

.DESCRIPTION
  Read-only preflight that verifies every substrate dependency required for
  the chore/r1-pilot-django-sidecar-binding deploy. Exits non-zero on the
  first missing precondition. Safe to run repeatedly. Does not mutate state.

  Validated:
    - Pilot RG, ACA env, KV all present and Succeeded
    - ACR image tag present in nzilacanadaacr
    - Pilot PG flexible-server state = Ready
    - Required KV secrets present (django-secret-pilot, PILOT-PG-ADMIN-PASSWORD,
      auth-secret-pilot)
    - Pilot Next container app exists (sidecar will be reached internally from it)
    - Sidecar container app NOT yet present (so this is the right-time deploy)

.NOTES
  Doctrine: docs/nzila-residual-closure/r1-pilot-django-sidecar-binding-closure.md
  Reviewer-of-record execution lane only. No symbolic certification.
#>
[CmdletBinding()]
param(
  [string]$Rg          = 'nzila-canada-pilot-rg',
  [string]$EnvName     = 'nzila-canada-pilot-env',
  [string]$Kv          = 'nzila-canada-pilot-kv',
  [string]$Acr         = 'nzilacanadaacr',
  [string]$Repository  = 'nzila-os-union-eyes-backend',
  [string]$ImageTag    = 'e37c430dca24fc15887f41061007755464f2c55c',
  [string]$NextApp     = 'nzila-os-union-eyes-pilot',
  [string]$SidecarApp  = 'nzila-os-union-eyes-django-pilot',
  [string]$PgServer    = 'nzila-canada-pilot-db'
)

$ErrorActionPreference = 'Stop'
$failures = @()

function Check-Result {
  param([string]$Label, [bool]$Ok, [string]$Detail = '')
  $marker = if ($Ok) { 'PASS' } else { 'FAIL' }
  Write-Host ("  [{0}] {1}{2}" -f $marker, $Label, $(if ($Detail) { " — $Detail" } else { '' }))
  if (-not $Ok) { $script:failures += $Label }
}

Write-Host "R1 pilot Django sidecar — preflight (read-only)" -ForegroundColor Cyan
Write-Host ""

# 1. Resource group
Write-Host "[1/7] Resource group"
$rgExists = (az group exists -n $Rg) -eq 'true'
Check-Result -Label "RG '$Rg' exists" -Ok $rgExists

# 2. ACA environment
Write-Host "[2/7] ACA environment"
$envState = az containerapp env show -g $Rg -n $EnvName --query properties.provisioningState -o tsv 2>$null
Check-Result -Label "Env '$EnvName' Succeeded" -Ok ($envState -eq 'Succeeded') -Detail $envState

# 3. Key Vault and required secrets
Write-Host "[3/7] Key Vault + required secrets"
$kvExists = $null -ne (az keyvault show -n $Kv --query name -o tsv 2>$null)
Check-Result -Label "KV '$Kv' exists" -Ok $kvExists
if ($kvExists) {
  $secrets = az keyvault secret list --vault-name $Kv --query "[].name" -o tsv
  foreach ($name in @('django-secret-pilot','PILOT-PG-ADMIN-PASSWORD','auth-secret-pilot')) {
    Check-Result -Label "KV secret '$name' present" -Ok ($secrets -contains $name)
  }
}

# 4. ACR image tag
Write-Host "[4/7] ACR image"
$tagExists = $null -ne (az acr repository show --name $Acr --image "${Repository}:${ImageTag}" --query name -o tsv 2>$null)
Check-Result -Label "Image '${Repository}:${ImageTag}' present in $Acr" -Ok $tagExists

# 5. Pilot PG ready
Write-Host "[5/7] Pilot PostgreSQL"
$pgState = az postgres flexible-server show -g $Rg -n $PgServer --query state -o tsv 2>$null
Check-Result -Label "PG '$PgServer' Ready" -Ok ($pgState -eq 'Ready') -Detail $pgState

# 6. Pilot Next container app exists (sidecar will be reached internally)
Write-Host "[6/7] Pilot Next app"
$nextFqdn = az containerapp show -g $Rg -n $NextApp --query properties.configuration.ingress.fqdn -o tsv 2>$null
Check-Result -Label "Next app '$NextApp' present" -Ok ([bool]$nextFqdn) -Detail $nextFqdn

# 7. Sidecar app NOT yet deployed (right-time check)
Write-Host "[7/7] Sidecar absence (right-time check)"
$sidecarExists = $null -ne (az containerapp show -g $Rg -n $SidecarApp --query name -o tsv 2>$null)
Check-Result -Label "Sidecar '$SidecarApp' not yet present" -Ok (-not $sidecarExists) `
  -Detail $(if ($sidecarExists) { 'already deployed — re-run is not the right action; use az containerapp update instead' } else { 'right-time' })

Write-Host ""
if ($failures.Count -eq 0) {
  Write-Host "PREFLIGHT PASSED — substrate is ready for r1-pilot-django-sidecar-deploy.ps1" -ForegroundColor Green
  exit 0
} else {
  Write-Host "PREFLIGHT FAILED — $($failures.Count) check(s) failed:" -ForegroundColor Red
  $failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  exit 1
}
