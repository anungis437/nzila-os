#!/usr/bin/env pwsh
# scripts/seed-demo-secrets.ps1
#
# One-off provisioning helper: issue demo-isolated auth/crypto secrets into
# `nzila-canada-demo-kv` so the demo container app can stop borrowing
# secrets from `nzila-staging-kv` (Tier 1A — see
# docs/nzila-infrastructure-convergence/tier-1-execution-log.md).
#
# Idempotency: `az keyvault secret set` versions the secret each call. Re-running
# this script ROTATES the secrets — only re-run when intentional rotation is
# desired and the dependent container env-var bindings are restarted afterward.
#
# Pre-req: caller must hold `Key Vault Secrets Officer` on the demo KV.
# Audit: every set call writes to the KV access policy log; the log line in
# Tier 1 execution log records the exact byte sizes used for each secret.

[CmdletBinding()]
param(
    [string] $VaultName = 'nzila-canada-demo-kv'
)

$ErrorActionPreference = 'Stop'

function New-RandomBase64Bytes([int]$Bytes) {
    $buffer = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    return [Convert]::ToBase64String($buffer)
}

# Demo-isolated auth/crypto secrets. NOT cross-tier credentials (Stripe/OpenAI
# /Resend remain in the shared catalog as documented residuals).
$items = @(
    @{ name = 'auth-secret-demo';             bytes = 48 },
    @{ name = 'django-secret-demo';           bytes = 48 },
    @{ name = 'enc-key-demo';                 bytes = 32 },
    @{ name = 'fallback-encryption-key-demo'; bytes = 32 },
    @{ name = 'pii-key-demo';                 bytes = 32 },
    @{ name = 'cron-secret-demo';             bytes = 32 },
    @{ name = 'auth-webhook-secret-demo';     bytes = 32 }
)

foreach ($item in $items) {
    $value = New-RandomBase64Bytes -Bytes $item.bytes
    $name = az keyvault secret set `
        --vault-name $VaultName `
        --name $item.name `
        --value $value `
        --query name `
        -o tsv
    Write-Host "set: $name (bytes=$($item.bytes))"
}

Write-Host "---vault $VaultName secrets after run---"
az keyvault secret list --vault-name $VaultName --query "[].name" -o tsv
