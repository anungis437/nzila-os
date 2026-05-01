param(
    [string]$Token = $env:DNS_API_TOKEN
)

$ZoneId = "e411d21f512ec3e03dad0d314c5013a0"
$EnvFqdn = "jollydune-88c1e97f.canadacentral.azurecontainerapps.io"
$VerificationId = "FE461FBBBD0EED3AB57D7D4AFA3C5B7D948C9CC77CED0FA6DDE389D5DDE26FF8"
$ZoneName = "nzilaventures.com"

# CNAME fixes: hostname prefix -> correct app FQDN target
$cnameFixes = @(
    @{ lbl = "control";          tgt = "nzila-os-control-plane.$EnvFqdn" }
    @{ lbl = "admin";            tgt = "nzila-os-platform-admin.$EnvFqdn" }
    @{ lbl = "staging-control";  tgt = "nzila-os-control-plane.$EnvFqdn" }
    @{ lbl = "staging-admin";    tgt = "nzila-os-platform-admin.$EnvFqdn" }
    @{ lbl = "staging-zonga";    tgt = "nzila-os-zonga.$EnvFqdn" }
    @{ lbl = "staging-console";  tgt = "nzila-os-console.$EnvFqdn" }
    @{ lbl = "staging-partners"; tgt = "nzila-os-partners.$EnvFqdn" }
    @{ lbl = "staging-flow";     tgt = "nzila-os-flow.$EnvFqdn" }
)

# asuid TXT records to add if missing
$missingTxtPrefixes = @(
    "asuid.admin",
    "asuid.staging-control",
    "asuid.staging-admin",
    "asuid.staging-console",
    "asuid.staging-partners",
    "asuid.staging-zonga",
    "asuid.staging-flow"
)

$hdrs = @{
    "Authorization" = "Bearer $Token"
    "Content-Type"  = "application/json"
}

# --- Get all existing CNAME records ---
Write-Host "`n=== Fetching existing CNAME records ===" -ForegroundColor Cyan
$cnameResp = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/dns_records?type=CNAME&per_page=100" -Headers $hdrs
if (-not $cnameResp.success) {
    Write-Host "ERROR: $($cnameResp.errors | ConvertTo-Json)" -ForegroundColor Red
    exit 1
}
Write-Host "Found $($cnameResp.result.Count) CNAME records"
$cnameResp.result | Select-Object id, name, content | Format-Table -AutoSize

# Build a fqdn -> record map
$cnameMap = @{}
foreach ($rec in $cnameResp.result) {
    $cnameMap[$rec.name] = $rec
}

# --- Fix incorrect CNAME records ---
Write-Host "`n=== Fixing CNAME records ===" -ForegroundColor Cyan
foreach ($item in $cnameFixes) {
    $fqdn = "$($item.lbl).$ZoneName"
    $correctTarget = $item.tgt
    $rec = $cnameMap[$fqdn]

    if ($null -eq $rec) {
        Write-Host "[$fqdn] NOT FOUND — creating" -ForegroundColor Yellow
        $body = [PSCustomObject]@{ type = "CNAME"; name = $fqdn; content = $correctTarget; ttl = 1; proxied = $false } | ConvertTo-Json
        $resp = Invoke-RestMethod -Method POST -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/dns_records" -Headers $hdrs -Body $body
        if ($resp.success) {
            Write-Host "[$fqdn] CREATED -> $correctTarget" -ForegroundColor Green
        } else {
            Write-Host "[$fqdn] CREATE ERROR: $($resp.errors | ConvertTo-Json)" -ForegroundColor Red
        }
        continue
    }

    if ($rec.content -eq $correctTarget) {
        Write-Host "[$fqdn] Already correct: $correctTarget" -ForegroundColor Green
        continue
    }

    Write-Host "[$fqdn] Updating: '$($rec.content)' -> '$correctTarget'" -ForegroundColor Yellow
    $body = [PSCustomObject]@{ type = "CNAME"; name = $fqdn; content = $correctTarget; ttl = 1; proxied = $false } | ConvertTo-Json
    $resp = Invoke-RestMethod -Method PUT -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/dns_records/$($rec.id)" -Headers $hdrs -Body $body
    if ($resp.success) {
        Write-Host "[$fqdn] UPDATED -> $correctTarget" -ForegroundColor Green
    } else {
        Write-Host "[$fqdn] UPDATE ERROR: $($resp.errors | ConvertTo-Json)" -ForegroundColor Red
    }
}

# --- Get existing TXT records ---
Write-Host "`n=== Fetching existing TXT records ===" -ForegroundColor Cyan
$txtResp = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/dns_records?type=TXT&per_page=100" -Headers $hdrs
$txtMap = @{}
foreach ($rec in $txtResp.result) {
    $txtMap[$rec.name] = $rec
}
Write-Host "Found $($txtResp.result.Count) TXT records"

# --- Add missing asuid TXT records ---
Write-Host "`n=== Adding missing asuid TXT records ===" -ForegroundColor Cyan
foreach ($prefix in $missingTxtPrefixes) {
    $fqdn = "$prefix.$ZoneName"
    if ($txtMap.ContainsKey($fqdn)) {
        $existing = $txtMap[$fqdn].content.Trim('"')
        if ($existing -eq $VerificationId) {
            Write-Host "[$fqdn] Already correct" -ForegroundColor Green
        } else {
            Write-Host "[$fqdn] EXISTS but wrong: $existing (skipping)" -ForegroundColor Yellow
        }
        continue
    }
    $body = [PSCustomObject]@{ type = "TXT"; name = $fqdn; content = $VerificationId; ttl = 1 } | ConvertTo-Json
    $resp = Invoke-RestMethod -Method POST -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/dns_records" -Headers $hdrs -Body $body
    if ($resp.success) {
        Write-Host "[$fqdn] CREATED TXT" -ForegroundColor Green
    } else {
        Write-Host "[$fqdn] TXT ERROR: $($resp.errors | ConvertTo-Json)" -ForegroundColor Red
    }
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
