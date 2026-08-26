$files = Get-ChildItem apps/union-eyes-demo -Recurse -Include *.ts,*.tsx -File
$imports = @()
foreach ($f in $files) {
  $content = Get-Content -Raw $f.FullName
  $ms = [regex]::Matches($content, "from\s+['`"]([^'`"]+)['`"]")
  foreach ($m in $ms) { $imports += $m.Groups[1].Value }
  $ms2 = [regex]::Matches($content, "require\(\s*['`"]([^'`"]+)['`"]\s*\)")
  foreach ($m in $ms2) { $imports += $m.Groups[1].Value }
  $ms3 = [regex]::Matches($content, "import\(\s*['`"]([^'`"]+)['`"]\s*\)")
  foreach ($m in $ms3) { $imports += $m.Groups[1].Value }
}
Write-Host "unique imports:" ($imports | Sort-Object -Unique).Count
$imports | Sort-Object -Unique | Group-Object {
  if ($_ -match "^@/components/ui/") { 'ui-primitives' }
  elseif ($_ -match "^@/components/demo") { 'demo-local-components' }
  elseif ($_ -match "^@/lib/demo") { 'demo-local-lib' }
  elseif ($_ -match "^@/components/") { 'BREACH-op-components' }
  elseif ($_ -match "^@/lib/") { 'BREACH-op-lib' }
  elseif ($_ -match "^@/db/") { 'BREACH-op-db' }
  elseif ($_ -match "^@nzila/") { 'nzila-pkg' }
  elseif ($_ -match "^\.\.") { 'relative-parent' }
  elseif ($_ -match "^\./") { 'relative-sibling' }
  else { 'external' }
} | Select-Object Count, Name | Sort-Object Count -Descending | Format-Table -AutoSize
Write-Host "---ALL @/ IMPORTS (unique)---"
$imports | Sort-Object -Unique | Where-Object { $_ -match "^@/" } | ForEach-Object { Write-Host $_ }
Write-Host ""
Write-Host "---ALL RELATIVE-PARENT---"
$imports | Sort-Object -Unique | Where-Object { $_ -match "^\.\." } | ForEach-Object { Write-Host $_ }
Write-Host ""
Write-Host "---ALL @nzila---"
$imports | Sort-Object -Unique | Where-Object { $_ -match "^@nzila" } | ForEach-Object { Write-Host $_ }
