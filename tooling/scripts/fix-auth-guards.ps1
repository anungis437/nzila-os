param([switch]$DryRun)

$ROOT = "C:\APPS\nzila-automation"
$AUTH_PATTERNS = @(
  'authorize(', 'withAuth(', 'requireEntityAccess(', 'requirePlatformRole(',
  'authenticateUser(', 'requireAuth(', 'constructEvent(', 'verifyHmac(',
  'verifyWebhookSignature(', 'await auth(', 'stripe.webhooks'
)
$PUBLIC_PATTERNS = @('/api/health', '/api/webhooks', '/api/public')

# Auth guard header to inject at top of GET/POST/etc handlers
$AUTH_HEADER = @'
import { auth } from '@nzila/platform-auth/entra/server';
'@

$AUTH_CALL = "  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })"

function Add-AuthGuard {
  param([string]$FilePath)
  
  $content = Get-Content -LiteralPath $FilePath -Raw
  
  # Already has platform-auth server import?
  $hasImport = $content.Contains("@nzila/platform-auth/entra/server")
  
  # Find first exported async function (GET, POST, PUT, PATCH, DELETE)
  $newContent = $content
  
  # Add import if missing
  if (-not $hasImport) {
    # Find the last import line and add after it  
    $lines = $content -split "`n"
    $lastImportIdx = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
      if ($lines[$i] -match "^import ") { $lastImportIdx = $i }
    }
    if ($lastImportIdx -ge 0) {
      $lines[$lastImportIdx] = $lines[$lastImportIdx] + "`nimport { auth } from '@nzila/platform-auth/entra/server';"
      $newContent = $lines -join "`n"
    } else {
      $newContent = "import { auth } from '@nzila/platform-auth/entra/server';`n" + $newContent
    }
  }
  
  # Inject auth check after opening brace of first exported async handler
  $newContent = $newContent -replace `
    '(export async function (?:GET|POST|PUT|PATCH|DELETE|HEAD)\s*\([^)]*\)\s*\{)',
    "`$1`n  const { userId } = await auth()`n  if (!userId) return new Response('Unauthorized', { status: 401 })`n"

  if ($newContent -ne $content) {
    if (-not $DryRun) {
      [System.IO.File]::WriteAllText($FilePath, $newContent)
    }
    return $true
  }
  return $false
}

$totalFixed = 0
$totalSkipped = 0

foreach ($app in @("union-eyes", "abr")) {
  $apiDir = Join-Path $ROOT "apps\$app\app\api"
  if (-not (Test-Path $apiDir)) { Write-Host "$app - no api dir"; continue }
  
  $routes = Get-ChildItem $apiDir -Recurse -Filter "route.ts"
  $appFixed = 0
  $appAlready = 0
  
  foreach ($r in $routes) {
    $rel = $r.FullName.Replace($ROOT + "\", "").Replace("\", "/")
    $isPublic = $PUBLIC_PATTERNS | Where-Object { $rel.Contains($_) }
    if ($isPublic) { continue }
    
    $content = Get-Content -LiteralPath $r.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    
    $hasAuth = $AUTH_PATTERNS | Where-Object { $content.Contains($_) }
    if ($hasAuth) { $appAlready++; continue }
    
    $fixed = Add-AuthGuard -FilePath $r.FullName
    if ($fixed) { $appFixed++ } else { $totalSkipped++ }
  }
  
  Write-Host "$app - fixed: $appFixed, already had auth: $appAlready"
  $totalFixed += $appFixed
}

Write-Host ""
Write-Host "Total fixed: $totalFixed"
