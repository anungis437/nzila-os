# reset_supabase_pwd.ps1 — Reset Supabase DB password via Management API
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]

$vault = New-Object Windows.Security.Credentials.PasswordVault
$cred = $vault.Retrieve("Supabase CLI:supabase", "supabase")
$cred.RetrievePassword()
$token = $cred.Password
Write-Host "Token retrieved, length: $($token.Length)"

$projectRef = "zdcmugkafbczvxcyofiz"  # ABR
$newPwd = "Nzila2026!AbrStaging#Migr8"

$headers = @{
    Authorization  = "Bearer $token"
    "Content-Type" = "application/json"
}

$body = @{ password = $newPwd } | ConvertTo-Json

try {
    $resp = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$projectRef/database/password" -Method PUT -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "ABR password reset SUCCESS"
    Write-Host ($resp | ConvertTo-Json -Compress)
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    Write-Host "Status: $($_.Exception.Response.StatusCode)"
    # Try alternate endpoint
    try {
        $resp2 = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$projectRef/database" -Method PATCH -Headers $headers -Body $body -ErrorAction Stop
        Write-Host "ABR password reset via PATCH SUCCESS"
    } catch {
        Write-Host "PATCH Error: $($_.Exception.Message)"
        # Try POST to config endpoint
        try {
            $body3 = @{ db_password = $newPwd } | ConvertTo-Json
            $resp3 = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$projectRef/config/database" -Method PUT -Headers $headers -Body $body3 -ErrorAction Stop
            Write-Host "Config update SUCCESS"
        } catch {
            Write-Host "Config Error: $($_.Exception.Message)"
        }
    }
}

# Also reset UE Supabase project if it exists
$ueRef = "xryvcdbmljxlsrfanvrv"  # union_eyes_app
$uePwd = "Nzila2026!UeStaging#Migr8"
$body2 = @{ password = $uePwd } | ConvertTo-Json

try {
    $resp4 = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$ueRef/database/password" -Method PUT -Headers $headers -Body $body2 -ErrorAction Stop
    Write-Host "UE Supabase password reset SUCCESS"
} catch {
    Write-Host "UE Supabase Error: $($_.Exception.Message)"
}
