# UnionEyes — Phase A One-Shot Environment Provisioning
#
# Provisions the four isolated environments (staging | demo | pilot | prod)
# defined in apps/union-eyes/infra/environments/union-eyes-env.bicep.
#
# Prereqs:
#   * az login   (tenant onelabtech.com)
#   * az account set --subscription 5d819f33-d16f-429c-a3c0-5b0e94740ba3
#   * Bicep CLI installed (`az bicep install`)
#   * Per-env Postgres admin passwords stored in a local secrets file or
#     entered interactively. NEVER commit these.
#
# Usage:
#   pwsh apps/union-eyes/infra/environments/provision-all.ps1 `
#       -StagingPgPassword (Read-Host -AsSecureString) `
#       -DemoPgPassword    (Read-Host -AsSecureString) `
#       -PilotPgPassword   (Read-Host -AsSecureString) `
#       -ProdPgPassword    (Read-Host -AsSecureString)
#
# Idempotent: re-running updates the existing resources in-place.
# Cost: each non-prod env ~ CAD ~$80-120/month (Burstable PG B2ms + small ACA).
# Prod env ~ CAD ~$350/month (D2s_v3 PG, ZoneRedundant HA, 2-6 ACA replicas).

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [SecureString] $StagingPgPassword,
  [Parameter(Mandatory = $true)] [SecureString] $DemoPgPassword,
  [Parameter(Mandatory = $true)] [SecureString] $PilotPgPassword,
  [Parameter(Mandatory = $true)] [SecureString] $ProdPgPassword,
  [string] $Subscription = '5d819f33-d16f-429c-a3c0-5b0e94740ba3',
  [string] $Location     = 'canadacentral'
)

$ErrorActionPreference = 'Stop'

az account set --subscription $Subscription | Out-Null

$repoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)))
$bicep    = Join-Path $PSScriptRoot 'union-eyes-env.bicep'

$envs = @(
  @{ Name = 'staging'; ResourceGroup = 'nzila-canada-staging-rg'; Password = $StagingPgPassword },
  @{ Name = 'demo';    ResourceGroup = 'nzila-canada-demo-rg';    Password = $DemoPgPassword    },
  @{ Name = 'pilot';   ResourceGroup = 'nzila-canada-pilot-rg';   Password = $PilotPgPassword   },
  @{ Name = 'prod';    ResourceGroup = 'nzila-canada-prod-rg';    Password = $ProdPgPassword    }
)

foreach ($e in $envs) {
  Write-Host "==== Provisioning environment: $($e.Name) → RG $($e.ResourceGroup) ====" -ForegroundColor Cyan

  az group create --name $e.ResourceGroup --location $Location | Out-Null

  $pwdPlain = [System.Net.NetworkCredential]::new('', $e.Password).Password

  az deployment group create `
    --resource-group $e.ResourceGroup `
    --template-file $bicep `
    --parameters environment=$($e.Name) postgresAdminPassword=$pwdPlain location=$Location `
    --output none

  if ($LASTEXITCODE -ne 0) {
    throw "Deployment failed for $($e.Name)"
  }

  # Persist the admin password to the per-env Key Vault so the app and CI can fetch it.
  az keyvault secret set `
    --vault-name "nzila-canada-$($e.Name)-kv" `
    --name DB-PASSWORD `
    --value $pwdPlain `
    --output none

  Write-Host "✓ $($e.Name) provisioned. KV=nzila-canada-$($e.Name)-kv  DB=nzila_os_$($e.Name)" -ForegroundColor Green
}

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Map custom domains (demo.unioneyes.app, pilot.unioneyes.app, app.unioneyes.app, staging-app.unioneyes.app)"
Write-Host "  2. Grant the new container apps' system-assigned identities AcrPull on nzilacanadaacr"
Write-Host "  3. Run: pnpm --filter @nzila/union-eyes db:migrate against each new DB"
Write-Host "  4. Run: npx tsx apps/union-eyes/scripts/seed-clc-demo-environment.ts against demo DB only"
