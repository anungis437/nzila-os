# PowerShell script to start dev server in Docker
$ErrorActionPreference = "Stop"

Write-Host "Building dev image..." -ForegroundColor Cyan
$imageId = docker build -q --target dev .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker build failed" -ForegroundColor Red
    exit 1
}

Write-Host "Starting dev server (ports 3000 and 3001)..." -ForegroundColor Green
Write-Host "Note: Code changes require rebuilding the image" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow

docker run --rm -it `
  -p 3000:3000 `
  -p 3001:3001 `
  --env-file apps/console/.env.local `
  $imageId `
  pnpm dev
