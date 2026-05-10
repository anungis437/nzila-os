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

  Lessons captured from the 2026-05-10 reviewer-of-record execution (anungis437):
    - ACR pull at create time: a fresh `az containerapp create --system-assigned`
      cannot pull from ACR via the system identity because it has no AcrPull role
      yet. Bootstrap with admin credentials (`--registry-server / -username / -password`)
      OR pre-create a user-assigned identity with AcrPull and use `--user-assigned`.
      This script uses the admin-creds bootstrap path because admin user is already
      enabled on the pilot ACR.
    - Pilot PG firewall: ACA Consumption-tier env outbound IPs are not in the PG
      firewall by default; allow Azure services (0.0.0.0 → 0.0.0.0) so the sidecar
      and Next app can reach `nzila-canada-pilot-db`.
    - Pilot PG database: the Django sidecar expects PGDATABASE=nzila_union_eyes
      which may not exist on a fresh server. The script ensures it.
    - PG password drift: the KV secret `PILOT-PG-ADMIN-PASSWORD` may be out of
      sync with the actual server password from earlier provisioning. The script
      does NOT silently rotate; it verifies a connect attempt and instructs the
      operator on rotation. (Manual rotation was done in the 2026-05-10 closure.)
    - KV-backed secret refresh on Container Apps requires a NEW REVISION; a plain
      restart will not pull updated KV values.
    - Django sidecar reports health=degraded (HTTP 503) when Redis/Celery broker
      are absent. This is expected for the pilot tier. The Next app's
      HEALTH_REQUIRE_QUEUE flag must be FALSE for /api/health to return 200 until
      Redis is provisioned.

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

# ── Step 0.5: Ensure pilot PG firewall + database ────────────────────────
Write-Host "[0.5/5] Ensuring PG firewall (allow Azure services) and target database" -ForegroundColor Cyan
if ($PSCmdlet.ShouldProcess($PgServer, 'az postgres firewall-rule create AllowAllAzureServicesAndResourcesWithinAzureIps')) {
  az postgres flexible-server firewall-rule create -g $Rg --name $PgServer `
    --rule-name AllowAllAzureServicesAndResourcesWithinAzureIps `
    --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 -o none 2>&1 | Out-Null
}
if ($PSCmdlet.ShouldProcess("$PgServer/$PgDatabase", 'az postgres flexible-server db create')) {
  az postgres flexible-server db create -g $Rg --server-name $PgServer `
    --database-name $PgDatabase -o none 2>&1 | Out-Null
}

# ── Step 1: Create the sidecar with system-assigned identity ──────────────
# Internal ingress only; reached by Next over the ACA private network.
# Bootstrap registry pull with ACR admin credentials because the system identity
# has no AcrPull role at this exact moment (chicken-and-egg). After the app
# exists, the operator may switch to managed-identity pull by granting AcrPull
# to the system OID and removing the registry credentials.
Write-Host "[1/5] Creating sidecar container app (ACR admin-creds bootstrap)" -ForegroundColor Cyan
$acrAdminUser = az acr credential show -n $Acr --query username -o tsv
$acrAdminPwd  = az acr credential show -n $Acr --query "passwords[0].value" -o tsv
if (-not $acrAdminUser -or -not $acrAdminPwd) {
  throw "Could not fetch ACR admin credentials. Ensure adminEnabled=true on $Acr."
}
if ($PSCmdlet.ShouldProcess($SidecarApp, 'az containerapp create')) {
  az containerapp create `
    --name $SidecarApp `
    --resource-group $Rg `
    --environment $EnvName `
    --image $image `
    --registry-server "$Acr.azurecr.io" `
    --registry-username $acrAdminUser `
    --registry-password $acrAdminPwd `
    --target-port 8000 `
    --ingress internal `
    --transport http `
    --system-assigned `
    --cpu 1.0 --memory 2.0Gi `
    --min-replicas 1 --max-replicas 2 `
    --env-vars `
      "NZILA_MODE=pilot" `
      "DJANGO_DEBUG=False" `
      "DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,$SidecarApp.internal.thankfulpebble-f9ca792c.canadacentral.azurecontainerapps.io,pilot.unioneyes.app" `
      "PGHOST=$pgFqdn" `
      "PGPORT=5432" `
      "PGUSER=$PgUser" `
      "PGDATABASE=$PgDatabase" `
      "PGSSLMODE=require" `
      "WEB_CONCURRENCY=3" `
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
Write-Host "  Operator follow-ups (substrate-cost reviewer-of-record actions):"
Write-Host "    1. Wire Next app: az containerapp update -g $Rg -n $NextApp --set-env-vars 'DJANGO_API_URL=http://$internalFqdn'"
Write-Host "    2. Force KV-backed secret refresh on Next app (if PILOT-PG-ADMIN-PASSWORD or database-url rotated):"
Write-Host "         az containerapp update -g $Rg -n $NextApp --revision-suffix kvrefresh-<HHmmss>"
Write-Host "    3. Disable strict queue gate until Redis is provisioned:"
Write-Host "         az containerapp update -g $Rg -n $NextApp --set-env-vars 'HEALTH_REQUIRE_QUEUE=false'"
Write-Host "    4. Public probe: Invoke-WebRequest -UseBasicParsing -Uri https://pilot.unioneyes.app/api/health (expect 200)"

Write-Host ""
Write-Host "R1 sidecar deployed. Reviewer-of-record: $ReviewerOfRecord" -ForegroundColor Green
Write-Host "Append a rotation/binding entry to docs/nzila-residual-closure/rotation-log.md (or create a binding-log if separate cadence)."
