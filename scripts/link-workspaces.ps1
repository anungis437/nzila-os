#!/usr/bin/env pwsh
# link-workspaces.ps1
# Copies workspace packages into node_modules for exFAT drives
# that don't support symlinks/junctions.
# Run after pnpm install or via: pnpm run link

$ErrorActionPreference = "SilentlyContinue"
$root = $PSScriptRoot | Split-Path -Parent

$pairs = @(
    # ── Root node_modules (every workspace package resolvable from root) ──
    @{src="packages\ai-core";          dst="node_modules\@nzila\ai-core"},
    @{src="packages\ai-sdk";           dst="node_modules\@nzila\ai-sdk"},
    @{src="packages\config";           dst="node_modules\@nzila\config"},
    @{src="packages\db";               dst="node_modules\@nzila\db"},
    @{src="packages\blob";             dst="node_modules\@nzila\blob"},
    @{src="packages\os-core";          dst="node_modules\@nzila\os-core"},
    @{src="packages\ui";               dst="node_modules\@nzila\ui"},
    @{src="packages\payments-stripe";  dst="node_modules\@nzila\payments-stripe"},
    @{src="packages\tax";              dst="node_modules\@nzila\tax"},    @{src="packages\tools-runtime";     dst="node_modules\@nzila\tools-runtime"},
    # ── Cross-package linking ──
    # packages/ui → devDep @nzila/config
    @{src="packages\config";           dst="packages\ui\node_modules\@nzila\config"},

    # packages/payments-stripe → deps @nzila/blob, @nzila/db
    # devDep @nzila/config (needed for nested tsconfig extends resolution)
    @{src="packages\blob";             dst="packages\payments-stripe\node_modules\@nzila\blob"},
    @{src="packages\db";               dst="packages\payments-stripe\node_modules\@nzila\db"},
    @{src="packages\config";           dst="packages\payments-stripe\node_modules\@nzila\config"},

    # packages/ai-core → deps @nzila/db, @nzila/blob, @nzila/os-core, @nzila/tools-runtime
    # devDep @nzila/config (needed for tsconfig extends resolution in nested copies)
    @{src="packages\db";               dst="packages\ai-core\node_modules\@nzila\db"},
    @{src="packages\blob";             dst="packages\ai-core\node_modules\@nzila\blob"},
    @{src="packages\os-core";          dst="packages\ai-core\node_modules\@nzila\os-core"},
    @{src="packages\tools-runtime";    dst="packages\ai-core\node_modules\@nzila\tools-runtime"},
    @{src="packages\config";           dst="packages\ai-core\node_modules\@nzila\config"},

    # packages/ai-sdk → dep @nzila/ai-core
    # devDep @nzila/config
    @{src="packages\ai-core";          dst="packages\ai-sdk\node_modules\@nzila\ai-core"},
    @{src="packages\config";           dst="packages\ai-sdk\node_modules\@nzila\config"},

    # packages/tax → deps @nzila/db, @nzila/os-core, @nzila/blob
    # devDep @nzila/config
    @{src="packages\db";               dst="packages\tax\node_modules\@nzila\db"},
    @{src="packages\os-core";          dst="packages\tax\node_modules\@nzila\os-core"},
    @{src="packages\blob";             dst="packages\tax\node_modules\@nzila\blob"},
    @{src="packages\config";           dst="packages\tax\node_modules\@nzila\config"},

    # ── apps/web → deps @nzila/ui; devDeps @nzila/config ──
    @{src="packages\ui";               dst="apps\web\node_modules\@nzila\ui"},
    @{src="packages\config";           dst="apps\web\node_modules\@nzila\config"},

    # ── apps/console → deps @nzila/db, @nzila/os-core, @nzila/blob, ──
    #    @nzila/payments-stripe, @nzila/ui, @nzila/ai-core, @nzila/ai-sdk,
    #    @nzila/qbo, @nzila/ml-sdk; devDeps @nzila/config
    @{src="packages\ai-core";          dst="apps\console\node_modules\@nzila\ai-core"},
    @{src="packages\ai-sdk";           dst="apps\console\node_modules\@nzila\ai-sdk"},
    @{src="packages\db";               dst="apps\console\node_modules\@nzila\db"},
    @{src="packages\os-core";          dst="apps\console\node_modules\@nzila\os-core"},
    @{src="packages\blob";             dst="apps\console\node_modules\@nzila\blob"},
    @{src="packages\payments-stripe";  dst="apps\console\node_modules\@nzila\payments-stripe"},
    @{src="packages\ui";               dst="apps\console\node_modules\@nzila\ui"},
    @{src="packages\qbo";              dst="apps\console\node_modules\@nzila\qbo"},
    @{src="packages\ml-sdk";           dst="apps\console\node_modules\@nzila\ml-sdk"},
    @{src="packages\ml-core";          dst="apps\console\node_modules\@nzila\ml-core"},
    @{src="packages\config";           dst="apps\console\node_modules\@nzila\config"}
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
