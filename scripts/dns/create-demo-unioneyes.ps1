param([string]$Token, [string]$ZoneId)
$VERIF = "FE461FBBBD0EED3AB57D7D4AFA3C5B7D948C9CC77CED0FA6DDE389D5DDE26FF8"
$DEMO_FQDN = "nzila-os-union-eyes-demo.greenmoss-d27e0e19.canadacentral.azurecontainerapps.io"
$h = @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" }

$body1 = @{ type = "TXT"; name = "asuid.demo"; content = $VERIF; ttl = 300 } | ConvertTo-Json
try {
    $r1 = Invoke-RestMethod -Method POST -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/dns_records" -Headers $h -Body $body1
    Write-Host "TXT asuid.demo: success=$($r1.success) id=$($r1.result.id)"
}
catch { Write-Host "TXT failed: $($_.ErrorDetails.Message)" }

$body2 = @{ type = "CNAME"; name = "demo"; content = $DEMO_FQDN; ttl = 300; proxied = $false } | ConvertTo-Json
try {
    $r2 = Invoke-RestMethod -Method POST -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/dns_records" -Headers $h -Body $body2
    Write-Host "CNAME demo: success=$($r2.success) id=$($r2.result.id)"
}
catch { Write-Host "CNAME failed: $($_.ErrorDetails.Message)" }
