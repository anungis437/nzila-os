$ErrorActionPreference = 'Continue'
$branchFiles = git diff --name-only origin/main...HEAD
$patterns = @(
  'b7b0cb9a-110d-4bf4-baa7',
  'nzila-canada-pilot-rg',
  'nzila-os-union-eyes-pilot',
  'CLIENT_SECRET=[A-Za-z0-9]',
  'SENDGRID_API_KEY=',
  'PGPASSWORD=[a-z]',
  'sk_live_',
  'sk_test_',
  'CLERK_SECRET_KEY='
)
$hits = @()
foreach ($f in $branchFiles) {
  if (Test-Path $f -PathType Leaf) {
    foreach ($p in $patterns) {
      $m = Select-String -Path $f -Pattern $p -ErrorAction SilentlyContinue
      if ($m) {
        foreach ($line in $m) {
          $hits += [pscustomobject]@{
            File    = $f
            Line    = $line.LineNumber
            Pattern = $p
            Snippet = ($line.Line -replace '\s+', ' ').Trim()
          }
        }
      }
    }
  }
}
"HIT COUNT: $($hits.Count)"
$hits | Sort-Object File,Line | Format-Table -AutoSize | Out-String
