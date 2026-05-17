#!/usr/bin/env pwsh
# Union Eyes — Cloudflare DNS update for Azure Front Door routing
#
# Prerequisites:
#   1. Cloudflare API token with `Zone:DNS:Edit` permission for unioneyes.app
#   2. PowerShell 7+ (pwsh)
#
# Usage:
#   $env:CF_API_TOKEN = "your-cloudflare-api-token"
#   ./apps/union-eyes/infra/dns/cloudflare-dns-afd.ps1
#
# What this script does:
#   1. Resolves the Cloudflare Zone ID for unioneyes.app
#   2. Adds the AFD DNS ownership validation TXT record:
#        _dnsauth.app.unioneyes.app  TXT  _q1en0zg4c8s9sockra3ayi3esqr7jw1
#   3. Updates (or creates) the CNAME record:
#        app.unioneyes.app  CNAME  ue-prod-a7cah9hhf9dycxcc.z02.azurefd.net  (DNS-only / grey cloud)
#
# After running this script:
#   - AFD will detect the TXT record and issue the managed TLS certificate
#   - Traffic to app.unioneyes.app will route through AFD + WAF
#   - Verify: curl -sv https://app.unioneyes.app/api/health/liveness
#     (look for x-azure-ref header in response)
#
# IMPORTANT: Cloudflare proxy MUST be disabled (proxied: false / grey cloud)
#   Double-proxying (Cloudflare + AFD) causes TLS handshake failures.

param(
    [string]$CFApiToken = $env:CF_API_TOKEN,
    [string]$ZoneName   = 'unioneyes.app',
    [string]$Hostname   = 'app.unioneyes.app',
    [string]$AfdEndpoint = 'ue-prod-a7cah9hhf9dycxcc.z02.azurefd.net',
    [string]$AfdValidationToken = '_q1en0zg4c8s9sockra3ayi3esqr7jw1', # gitleaks:allow — AFD DNS ownership proof token, not a credential
    [string]$ValidationTokenExpiry = '2026-05-24T20:45:36Z'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $CFApiToken) {
    Write-Error "CF_API_TOKEN environment variable not set. Provide via: `$env:CF_API_TOKEN = 'your-token'"
    exit 1
}

$headers = @{
    'Authorization' = "Bearer $CFApiToken"
    'Content-Type'  = 'application/json'
}

function Invoke-CF {
    param([string]$Method, [string]$Path, [hashtable]$Body = $null)
    $uri = "https://api.cloudflare.com/client/v4$Path"
    $params = @{ Method = $Method; Uri = $uri; Headers = $headers }
    if ($Body) { $params['Body'] = $Body | ConvertTo-Json -Depth 10 }
    $resp = Invoke-RestMethod @params
    if (-not $resp.success) {
        Write-Error "Cloudflare API error: $($resp.errors | ConvertTo-Json)"
    }
    return $resp
}

# 1. Resolve zone ID
Write-Host "Resolving zone ID for $ZoneName..."
$zones = Invoke-CF -Method GET -Path "/zones?name=$ZoneName"
if ($zones.result.Count -eq 0) {
    Write-Error "No Cloudflare zone found for $ZoneName. Verify zone ownership and token permissions."
}
$zoneId = $zones.result[0].id
Write-Host "  Zone ID: $zoneId"

# 2. AFD DNS ownership validation TXT record
$txtName = "_dnsauth.app"
$txtValue = $AfdValidationToken
Write-Host ""
Write-Host "Checking for existing TXT record $txtName.$ZoneName..."
$existingTxt = Invoke-CF -Method GET -Path "/zones/$zoneId/dns_records?type=TXT&name=${txtName}.${ZoneName}"

if ($existingTxt.result.Count -gt 0) {
    $recId = $existingTxt.result[0].id
    Write-Host "  Updating existing TXT record (id: $recId)..."
    Invoke-CF -Method PUT -Path "/zones/$zoneId/dns_records/$recId" -Body @{
        type    = 'TXT'
        name    = $txtName
        content = $txtValue
        ttl     = 300
    } | Out-Null
    Write-Host "  TXT record updated."
} else {
    Write-Host "  Creating TXT record..."
    Invoke-CF -Method POST -Path "/zones/$zoneId/dns_records" -Body @{
        type    = 'TXT'
        name    = $txtName
        content = $txtValue
        ttl     = 300
    } | Out-Null
    Write-Host "  TXT record created."
}

# 3. CNAME record for app.unioneyes.app -> AFD endpoint (DNS-only, NOT proxied)
Write-Host ""
Write-Host "Checking for existing CNAME record for $Hostname..."
$existingCname = Invoke-CF -Method GET -Path "/zones/$zoneId/dns_records?type=CNAME&name=$Hostname"

$cnameBody = @{
    type    = 'CNAME'
    name    = 'app'
    content = $AfdEndpoint
    ttl     = 1       # 1 = automatic / Cloudflare managed
    proxied = $false  # MUST be false — AFD handles TLS; double-proxying breaks TLS
}

if ($existingCname.result.Count -gt 0) {
    $recId = $existingCname.result[0].id
    Write-Host "  Updating existing CNAME record (id: $recId)..."
    Invoke-CF -Method PUT -Path "/zones/$zoneId/dns_records/$recId" -Body $cnameBody | Out-Null
    Write-Host "  CNAME updated: $Hostname -> $AfdEndpoint (DNS-only)"
} else {
    Write-Host "  Creating CNAME record..."
    Invoke-CF -Method POST -Path "/zones/$zoneId/dns_records" -Body $cnameBody | Out-Null
    Write-Host "  CNAME created: $Hostname -> $AfdEndpoint (DNS-only)"
}

Write-Host ""
Write-Host "Done. Cloudflare DNS records updated."
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Wait 2-5 minutes for DNS propagation"
Write-Host "  2. Check AFD domain validation state:"
Write-Host "     az afd custom-domain show --resource-group nzila-canada-prod-rg --profile-name nzila-ue-afd-prod --custom-domain-name ue-app-unioneyes --query domainValidationState"
Write-Host "  3. Wait for AFD TLS cert issuance (~10-15 min)"
Write-Host "  4. Smoke test:"
Write-Host "     curl -sv https://app.unioneyes.app/api/health/liveness"
Write-Host "  5. Confirm x-azure-ref header is present in response"
Write-Host ""
Write-Host "  TXT validation token expires: $ValidationTokenExpiry"
Write-Host "  If expired, regenerate via:"
Write-Host "     az afd custom-domain regenerate-validation-token --resource-group nzila-canada-prod-rg --profile-name nzila-ue-afd-prod --custom-domain-name ue-app-unioneyes"
