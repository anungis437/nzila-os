#!/usr/bin/env pwsh
# link-workspaces.ps1
# Copies workspace packages into node_modules for exFAT drives
# that don't support symlinks/junctions.
# Run after pnpm install or via: pnpm run link

$ErrorActionPreference = "SilentlyContinue"
$root = $PSScriptRoot | Split-Path -Parent

$pairs = @(
    @{src="packages\config"; dst="node_modules\@nzila\config"},
    @{src="packages\config"; dst="apps\web\node_modules\@nzila\config"},
    @{src="packages\config"; dst="apps\console\node_modules\@nzila\config"},
    @{src="packages\config"; dst="packages\ui\node_modules\@nzila\config"},
    @{src="packages\ui"; dst="node_modules\@nzila\ui"},
    @{src="packages\ui"; dst="apps\web\node_modules\@nzila\ui"},
    @{src="packages\ui"; dst="apps\console\node_modules\@nzila\ui"}
)

Push-Location $root
foreach ($p in $pairs) {
    $parent = Split-Path $p.dst -Parent
    if (!(Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    if (Test-Path $p.dst) { Remove-Item -Recurse -Force $p.dst }
    Copy-Item -Recurse -Force $p.src $p.dst
    Write-Host "  linked: $($p.src) -> $($p.dst)"
}
Pop-Location
Write-Host "Workspace packages linked (copy mode for exFAT)"
