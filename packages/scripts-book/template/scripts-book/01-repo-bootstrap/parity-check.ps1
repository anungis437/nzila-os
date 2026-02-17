Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# -----------------------------------------------------------------------------
# parity-check.ps1 — Verify .sh / .ps1 / .py triplet parity for all scripts
# -----------------------------------------------------------------------------

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BookRoot  = Resolve-Path (Join-Path $ScriptDir "..")

$ExitCode = 0

Write-Host "==> Checking .sh / .ps1 / .py parity in $BookRoot ..."

# Check that every .sh has a .ps1 and .py
Get-ChildItem -Path $BookRoot -Recurse -Filter "*.sh" | ForEach-Object {
    $ps1File = $_.FullName -replace '\.sh$', '.ps1'
    $pyFile  = $_.FullName -replace '\.sh$', '.py'
    if (-not (Test-Path $ps1File)) {
        Write-Host "MISSING .ps1 for: $($_.FullName)"
        $ExitCode = 1
    }
    if (-not (Test-Path $pyFile)) {
        Write-Host "MISSING .py  for: $($_.FullName)"
        $ExitCode = 1
    }
}

# Check that every .ps1 has a .sh and .py
Get-ChildItem -Path $BookRoot -Recurse -Filter "*.ps1" | ForEach-Object {
    $shFile = $_.FullName -replace '\.ps1$', '.sh'
    $pyFile = $_.FullName -replace '\.ps1$', '.py'
    if (-not (Test-Path $shFile)) {
        Write-Host "MISSING .sh  for: $($_.FullName)"
        $ExitCode = 1
    }
    if (-not (Test-Path $pyFile)) {
        Write-Host "MISSING .py  for: $($_.FullName)"
        $ExitCode = 1
    }
}

# Check that every .py has a .sh and .ps1
Get-ChildItem -Path $BookRoot -Recurse -Filter "*.py" | ForEach-Object {
    $shFile  = $_.FullName -replace '\.py$', '.sh'
    $ps1File = $_.FullName -replace '\.py$', '.ps1'
    if (-not (Test-Path $shFile)) {
        Write-Host "MISSING .sh  for: $($_.FullName)"
        $ExitCode = 1
    }
    if (-not (Test-Path $ps1File)) {
        Write-Host "MISSING .ps1 for: $($_.FullName)"
        $ExitCode = 1
    }
}

if ($ExitCode -eq 0) {
    Write-Host "==> All scripts have matching triplets. Parity OK."
} else {
    Write-Host "==> Parity check FAILED. See mismatches above."
}

exit $ExitCode
