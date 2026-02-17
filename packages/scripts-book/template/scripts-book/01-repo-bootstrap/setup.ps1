Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# -----------------------------------------------------------------------------
# setup.ps1 — Bootstrap {{REPO_NAME}} for local development (Windows)
# -----------------------------------------------------------------------------

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot  = Resolve-Path (Join-Path $ScriptDir "../..")

Write-Host "==> Bootstrapping {{REPO_NAME}} ..."

# 1. Install pnpm dependencies
Write-Host "--- Installing pnpm dependencies ---"
Push-Location $RepoRoot
try {
    pnpm install --frozen-lockfile
} finally {
    Pop-Location
}

# 2. Copy environment template if .env.local does not exist
$EnvLocal = Join-Path $RepoRoot ".env.local"
$EnvExample = Join-Path $RepoRoot ".env.example"

if (-not (Test-Path $EnvLocal)) {
    Write-Host "--- Copying .env.example → .env.local ---"
    Copy-Item $EnvExample $EnvLocal
} else {
    Write-Host "--- .env.local already exists, skipping copy ---"
}

# 3. Database setup placeholder
Write-Host "--- Running database setup ---"
try {
    pnpm --filter {{PRIMARY_APP_PATH}} run db:push
} catch {
    Write-Warning "db:push failed — verify DATABASE_URL in .env.local"
}

Write-Host "==> Bootstrap complete. Run 'pnpm --filter {{PRIMARY_APP_PATH}} run dev' to start."
