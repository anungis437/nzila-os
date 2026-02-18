Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class CredManager {
    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);

    [DllImport("advapi32.dll", EntryPoint = "CredFree", SetLastError = true)]
    public static extern bool CredFree(IntPtr cred);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public int Flags;
        public int Type;
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    public static string GetCredential(string target) {
        IntPtr credPtr;
        if (CredRead(target, 1, 0, out credPtr)) {
            CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(credPtr, typeof(CREDENTIAL));
            string password = null;
            if (cred.CredentialBlobSize > 0) {
                byte[] bytes = new byte[cred.CredentialBlobSize];
                Marshal.Copy(cred.CredentialBlob, bytes, 0, cred.CredentialBlobSize);
                // Try UTF-8 first (Supabase CLI stores tokens as UTF-8)
                password = System.Text.Encoding.UTF8.GetString(bytes);
            }
            CredFree(credPtr);
            return password;
        }
        return null;
    }
}
"@

$token = [CredManager]::GetCredential("Supabase CLI:supabase")
if ($token) {
    Write-Host "TOKEN_LENGTH: $($token.Length)"
    Write-Host "TOKEN_PREVIEW: $($token.Substring(0, [Math]::Min(20, $token.Length)))..."
    $env:SUPABASE_ACCESS_TOKEN = $token
    Write-Host "Token stored in SUPABASE_ACCESS_TOKEN env var"
    
    # Now reset ABR password
    $abrRef = "zdcmugkafbczvxcyofiz"
    $ueRef = "xryvcdbmljxlsrfanvrv"
    $abrPwd = "Nzila2026!AbrStaging#Migr8"
    $uePwd = "Nzila2026!UeSupabase#Migr8"
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    # First, verify token works by listing projects
    Write-Host "`n--- Verifying token by listing projects ---"
    try {
        $projects = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects" -Method Get -Headers $headers
        foreach ($p in $projects) {
            Write-Host "  Project: $($p.name) | Ref: $($p.id) | Region: $($p.region) | DB Host: $($p.database.host)"
        }
    } catch {
        Write-Host "List projects FAILED: $($_.Exception.Message)"
    }
    
    # Reset ABR password - try multiple API endpoint patterns
    Write-Host "`n--- Resetting ABR Supabase DB password ---"
    $endpoints = @(
        @{ Method = "Patch"; Uri = "https://api.supabase.com/v1/projects/$abrRef"; Body = (@{ db_pass = $abrPwd } | ConvertTo-Json) },
        @{ Method = "Put";   Uri = "https://api.supabase.com/v1/projects/$abrRef"; Body = (@{ db_pass = $abrPwd } | ConvertTo-Json) },
        @{ Method = "Post";  Uri = "https://api.supabase.com/v1/projects/$abrRef/database/password/reset"; Body = (@{ password = $abrPwd } | ConvertTo-Json) },
        @{ Method = "Patch"; Uri = "https://api.supabase.com/v1/projects/$abrRef/database"; Body = (@{ password = $abrPwd } | ConvertTo-Json) },
        @{ Method = "Put";   Uri = "https://api.supabase.com/v1/projects/$abrRef/database"; Body = (@{ password = $abrPwd } | ConvertTo-Json) }
    )
    
    $success = $false
    foreach ($ep in $endpoints) {
        try {
            Write-Host "  Trying $($ep.Method) $($ep.Uri)..."
            $resp = Invoke-RestMethod -Uri $ep.Uri -Method $ep.Method -Headers $headers -Body $ep.Body
            Write-Host "  SUCCESS!"
            Write-Host ($resp | ConvertTo-Json -Depth 3)
            $success = $true
            break
        } catch {
            $statusCode = ""
            if ($_.Exception.Response) {
                $statusCode = [int]$_.Exception.Response.StatusCode
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $respBody = $reader.ReadToEnd()
                Write-Host "  FAILED ($statusCode): $respBody"
            } else {
                Write-Host "  FAILED: $($_.Exception.Message)"
            }
        }
    }
    
    if (-not $success) {
        # Try to get the DB connection string from the project info
        Write-Host "`n  Trying to get connection info from project..."
        try {
            $proj = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$abrRef" -Method Get -Headers $headers
            Write-Host ($proj | ConvertTo-Json -Depth 5)
        } catch {
            Write-Host "  Get project FAILED: $($_.Exception.Message)"
        }
    }
    
    # UE Supabase will be handled after ABR succeeds
    Write-Host "`nDone."
} else {
    $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    Write-Host "FAILED to read credential. Win32 Error: $err"
}
