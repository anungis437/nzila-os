<#
.SYNOPSIS
  R1 pilot Django sidecar — live deploy runbook (substrate-cost reviewer-of-record action).

.DESCRIPTION
  Provisions the Django sidecar container app in the pilot fabric. Refuses to
  run if the preflight has not passed. Idempotent in spirit: if the sidecar
  already exists, refuses (use `az containerapp update` for revisions instead).

  This script is the operational surface of the R1 closure procedure. It is
  governance-safe, evidence-anchored, reviewer-of-record bound. Live deploy is
  substrate-cost and must be invoked by a reviewer-of-record explicitly with
  -ConfirmDeploy switch.

  Required preconditions (all enforced by preflight):
    - Pilot RG, ACA env, KV all Succeeded
    - Image nzila-os-union-eyes-backend:<tag> present in ACR
    - Pilot PG Ready
    - KV secrets: django-secret-pilot, PILOT-PG-ADMIN-PASSWORD, auth-secret-pilot
    - Pilot Next app present
    - Sidecar app NOT yet present

  Post-deploy verification:
    1. Sidecar revision Healthy / RunningAtMaxScale
    2. KV role assignment created
    3. Internal connectivity from Next → Django on port 80 (ACA internal ingress)
    4. /api/auth_core/health/ returns 200 from inside the Next app

.NOTES
  Doctrine: docs/nzila-residual-closure/r1-pilot-django-sidecar-binding-closure.md
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory)]
  [switch]$ConfirmDeploy,

  [string]$Rg          = 'nzila-canada-pilot-rg',
  [string]$EnvName     = 'nzila-canada-pilot-env',
  [string]$Kv          = 'nzila-canada-pilot-kv',
  [string]$Acr         = 'nzilacanadaacr',
  [string]$Repository  = 'nzila-os-union-eyes-backend',
  [string]$ImageTag    = 'e37c430dca24fc15887f41061007755464f2c55c',
  [string]$NextApp     = 'nzila-os-union-eyes-pilot',
  [string]$SidecarApp  = 'nzila-os-union-eyes-django-pilot',
  [string]$PgServer    = 'nzila-canada-pilot-db',
  [string]$PgUser      = 'nzila',
  [string]$PgDatabase  = 'nzila_union_eyes',
  [string]$ReviewerOfRecord
)

$ErrorActionPreference = 'Stop'

if (-not $ConfirmDeploy) {
  throw "R1 deploy refused: pass -ConfirmDeploy to acknowledge substrate-cost reviewer-of-record action."
}

if (-not $ReviewerOfRecord) {
  throw "R1 deploy refused: pass -ReviewerOfRecord <github-handle> for audit trail."
}

# ── Step 0: Run preflight ──────────────────────────────────────────────────
$preflight = Join-Path $PSScriptRoot 'r1-pilot-django-sidecar-preflight.ps1'
Write-Host "[0/5] Running preflight ($preflight)" -ForegroundColor Cyan
& $preflight -Rg $Rg -EnvName $EnvName -Kv $Kv -Acr $Acr -Repository $Repository `
  -ImageTag $ImageTag -NextApp $NextApp -SidecarApp $SidecarApp -PgServer $PgServer
if ($LASTEXITCODE -ne 0) { throw "Preflight failed; refusing to deploy." }

$image  = "$Acr.azurecr.io/${Repository}:${ImageTag}"
$kvHost = "$Kv.vault.azure.net"
$pgFqdn = az postgres flexible-server show -g $Rg -n $PgServer --query fullyQualifiedDomainName -o tsv

Write-Host ""
Write-Host "Deploy plan:" -ForegroundColor Cyan
Write-Host "  Reviewer-of-record : $ReviewerOfRecord"
Write-Host "  Sidecar app        : $SidecarApp (RG=$Rg env=$EnvName)"
Write-Host "  Image              : $image"
Write-Host "  PG host            : $pgFqdn (db=$PgDatabase user=$PgUser)"
Write-Host "  KV                 : $Kv"
Write-Host ""

# ── Step 1: Create the sidecar with system-assigned identity ──────────────
# Internal ingress only; reached by Next over the ACA private network.
Write-Host "[1/5] Creating sidecar container app" -ForegroundColor Cyan
if ($PSCmdlet.ShouldProcess($SidecarApp, 'az containerapp create')) {
  az containerapp create `
    --name $SidecarApp `
    --resource-group $Rg `
    --environment $EnvName `
    --image $image `
    --target-port 8000 `
    --ingress internal `
    --transport http `
    --system-assigned `
    --cpu 0.5 --memory 1.0Gi `
    --min-replicas 1 --max-replicas 2 `
    --env-vars `
      "NZILA_MODE=pilot" `
      "DJANGO_DEBUG=False" `
      "DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,$SidecarApp.internal.thankfulpebble-f9ca792c.canadacentral.azurecontainerapps.io,pilot.unioneyes.app" `
      "PGHOST=$pgFqdn" `
      "PGPORT=5432" `
      "PGUSER=$PgUser" `
      "PGDATABASE=$PgDatabase" `
      "CORS_ALLOWED_ORIGINS=https://pilot.unioneyes.app" `
    -o none
  if ($LASTEXITCODE -ne 0) { throw "Sidecar creation failed." }
}

# ── Step 2: Grant identity Key Vault Secrets User on pilot KV ──────────────
Write-Host "[2/5] Granting sidecar identity Key Vault Secrets User on $Kv" -ForegroundColor Cyan
$oid   = az containerapp show -g $Rg -n $SidecarApp --query identity.principalId -o tsv
$kvId  = az keyvault show -n $Kv --query id -o tsv
if (-not $oid -or -not $kvId) { throw "Could not resolve identity OID or KV id." }
if ($PSCmdlet.ShouldProcess("$oid → $Kv", 'role assignment Key Vault Secrets User')) {
  az role assignment create --assignee $oid --role "Key Vault Secrets User" --scope $kvId -o none 2>&1 | Out-Null
  Start-Sleep -Seconds 10  # propagation
}

# ── Step 3: Wire KV-backed secrets (now that identity has access) ─────────
Write-Host "[3/5] Binding KV-backed secrets" -ForegroundColor Cyan
if ($PSCmdlet.ShouldProcess($SidecarApp, 'az containerapp secret set')) {
  az containerapp secret set -g $Rg -n $SidecarApp --secrets `
    "django-secret-key=keyvaultref:https://$kvHost/secrets/django-secret-pilot,identityref:system" `
    "pgpassword=keyvaultref:https://$kvHost/secrets/PILOT-PG-ADMIN-PASSWORD,identityref:system" `
    "auth-secret=keyvaultref:https://$kvHost/secrets/auth-secret-pilot,identityref:system" `
    -o none
  if ($LASTEXITCODE -ne 0) { throw "KV secret binding failed." }
}

if ($PSCmdlet.ShouldProcess($SidecarApp, 'az containerapp update --set-env-vars (secret refs)')) {
  az containerapp update -g $Rg -n $SidecarApp --set-env-vars `
    "DJANGO_SECRET_KEY=secretref:django-secret-key" `
    "PGPASSWORD=secretref:pgpassword" `
    "AUTH_SECRET=secretref:auth-secret" `
    -o none
}

# ── Step 4: Wait for healthy revision ──────────────────────────────────────
Write-Host "[4/5] Waiting for healthy revision" -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes(5)
do {
  Start-Sleep -Seconds 15
  $rev = az containerapp revision list -g $Rg -n $SidecarApp --query "[0].{name:name,active:properties.active,health:properties.healthState,replicas:properties.replicas}" -o json | ConvertFrom-Json
  Write-Host ("  revision={0} active={1} health={2} replicas={3}" -f $rev.name, $rev.active, $rev.health, $rev.replicas)
} while (($rev.health -ne 'Healthy') -and ((Get-Date) -lt $deadline))

if ($rev.health -ne 'Healthy') {
  throw "Sidecar revision did not reach Healthy within 5 minutes. Inspect: az containerapp logs show -g $Rg -n $SidecarApp --tail 200"
}

# ── Step 5: Internal smoke from Next app ───────────────────────────────────
Write-Host "[5/5] Internal smoke (Next → Django /api/auth_core/health/)" -ForegroundColor Cyan
$internalFqdn = az containerapp show -g $Rg -n $SidecarApp --query properties.configuration.ingress.fqdn -o tsv
Write-Host "  Sidecar internal FQDN: $internalFqdn"
Write-Host "  Run from operator host (requires Next app to be wired with DJANGO_API_URL=http://$internalFqdn):"
Write-Host "    az containerapp exec -g $Rg -n $NextApp --command 'curl -sf http://$internalFqdn/api/auth_core/health/'"

Write-Host ""
Write-Host "R1 sidecar deployed. Reviewer-of-record: $ReviewerOfRecord" -ForegroundColor Green
Write-Host "Next reviewer-of-record action: wire DJANGO_API_URL on $NextApp to http://$internalFqdn and verify https://pilot.unioneyes.app/api/auth_core/health/ returns 200."
Write-Host "Append a rotation/binding entry to docs/nzila-residual-closure/rotation-log.md (or create a binding-log if separate cadence)." 
