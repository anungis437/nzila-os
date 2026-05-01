$ErrorActionPreference = 'Stop'
$rg        = 'nzila-canada-staging-rg'
$env_name  = 'nzila-canada-staging-env'
$acr       = 'nzilacanadaacr.azurecr.io'
$sub       = '5d819f33-d16f-429c-a3c0-5b0e94740ba3'
$imgTag    = 'latest'

# Retrieve secrets from reference app (nzila-os-web)
$secretsRaw = az rest --method post `
  --url "https://management.azure.com/subscriptions/$sub/resourceGroups/$rg/providers/Microsoft.App/containerApps/nzila-os-web/listSecrets?api-version=2024-03-01" `
  -o json | ConvertFrom-Json

$secretMap = @{}
foreach ($s in $secretsRaw.value) { $secretMap[$s.name] = $s.value }

if ($secretMap.Count -eq 0) { throw "Failed to retrieve secrets from nzila-os-web" }
Write-Host "Retrieved $($secretMap.Count) secrets from nzila-os-web"

# Common env vars template (non-sensitive)
$commonEnvBase = @(
  "NODE_ENV=production",
  "NEXT_TELEMETRY_DISABLED=1",
  "AZURE_AD_CLIENT_ID=b7b0cb9a-110d-4bf4-baa7-d936d7450181",
  "AZURE_AD_TENANT_ID=5082b8be-b04d-4a13-b61c-b6397670177b",
  "ROLLBACK_MARKER=20260501150000"
)

# Per-app configuration
$appConfigs = @(
  @{ app='flow';            port=3000; healthPath='/api/health';  ingress='external' }
  @{ app='cfo';             port=3000; healthPath='/api/health';  ingress='external' }
  @{ app='agrimo';          port=3000; healthPath='/api/health';  ingress='external' }
  @{ app='cora';            port=3000; healthPath='/api/health';  ingress='external' }
  @{ app='trade';           port=3000; healthPath='/api/health';  ingress='external' }
  @{ app='mobility';        port=3000; healthPath='/api/health';  ingress='external' }
  @{ app='orchestrator-api'; port=4000; healthPath='/health';     ingress='external' }
  @{ app='abr';             port=3000; healthPath='/api/health';  ingress='external' }
)

$results = @()
foreach ($cfg in $appConfigs) {
  $appName = $cfg.app
  $caName  = "nzila-os-$appName"
  $image   = "$acr/nzila/$appName`:$imgTag"

  Write-Host "`n=== Processing $caName ==="

  # Check if already exists
  $existing = az containerapp show -g $rg -n $caName -o json 2>$null | ConvertFrom-Json
  if ($null -ne $existing) {
    Write-Host "  $caName already exists — skipping creation, will verify"
    $results += [pscustomobject]@{ app=$appName; caName=$caName; action='skipped-exists'; status='ok' }
    continue
  }

  # Build secrets string array
  $secretPairs = @(
    "auth-secret=$($secretMap['auth-secret'])",
    "database-url=$($secretMap['database-url'])",
    "azure-ad-client-secret=$($secretMap['azure-ad-client-secret'])"
  )

  # Build env vars array
  $envVars = $commonEnvBase + @(
    "PORT=$($cfg.port)",
    "AUTH_SECRET=secretref:auth-secret",
    "DATABASE_URL=secretref:database-url",
    "AZURE_AD_CLIENT_SECRET=secretref:azure-ad-client-secret",
    "NEXT_PUBLIC_APP_ENV=staging"
  )

  Write-Host "  Creating $caName with image $image on port $($cfg.port)..."

  try {
    az containerapp create `
      --name $caName `
      --resource-group $rg `
      --environment $env_name `
      --image $image `
      --cpu 0.5 `
      --memory 1.0Gi `
      --min-replicas 0 `
      --max-replicas 2 `
      --ingress $($cfg.ingress) `
      --target-port $($cfg.port) `
      --registry-server $acr `
      --secrets $secretPairs `
      --env-vars $envVars `
      --system-assigned `
      --output none

    Write-Host "  Created $caName successfully"
    $results += [pscustomobject]@{ app=$appName; caName=$caName; action='created'; status='ok' }
  } catch {
    Write-Warning "  Failed to create $caName`: $($_.Exception.Message)"
    $results += [pscustomobject]@{ app=$appName; caName=$caName; action='create-failed'; status='error'; error=$_.Exception.Message }
  }
}

Write-Host "`n=== Deployment Summary ==="
$results | Format-Table -AutoSize
