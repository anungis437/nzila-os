param([switch]$ParseOnly, [switch]$PolicyDefinitionOnly)
$ErrorActionPreference = 'Stop'
if ($ParseOnly) { return }
$subscription = '5d819f33-d16f-429c-a3c0-5b0e94740ba3'
$tenant = '5082b8be-b04d-4a13-b61c-b6397670177b'
$azurePython = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\python.exe'
$root = Join-Path $PSScriptRoot 'g3-readiness-evidence'
$ledgerPath = Join-Path $root 'G3R1_AZURE_READ_LEDGER.json'
if ((Test-Path -LiteralPath $ledgerPath) -and -not $PolicyDefinitionOnly) { throw 'G3R1 read ledger already exists;refuse evidence overwrite.' }
$ledger = [System.Collections.Generic.List[object]]::new()
if ($PolicyDefinitionOnly) {
  foreach ($entry in @(Get-Content -LiteralPath $ledgerPath -Raw | ConvertFrom-Json)) { $ledger.Add($entry) }
}
function Read-Control {
  param([string]$Name, [string[]]$Arguments)
  $base = "https://management.azure.com/subscriptions/$subscription/providers/Microsoft.Authorization/"
  $account = ($Arguments -join '|') -eq 'account|show|--query|{id:id,tenantId:tenantId,state:state}'
  $allowed = $Arguments.Count -eq 5 -and $Arguments[0] -eq 'rest' -and $Arguments[1] -eq '--method' -and $Arguments[2] -eq 'get' -and $Arguments[3] -eq '--url' -and (
    $Arguments[4] -eq 'https://graph.microsoft.com/beta/organization?$select=id,directorySizeQuota' -or
    $Arguments[4] -eq 'https://management.azure.com/providers/Microsoft.Authorization/policyDefinitions/7509877f-d414-4d79-8d1f-d600ea78d087?api-version=2023-04-01' -or
    $Arguments[4].StartsWith("${base}policyAssignments?") -or
    $Arguments[4].StartsWith("${base}denyAssignments?")
  )
  if (-not ($account -or $allowed)) { throw 'G3R1_ACCOUNT_READ_ALLOWLIST_ONLY' }
  $response = "G3R1_$Name.json"
  $entry = [ordered]@{ name = $Name; command = @('az') + $Arguments; method = $(if ($account) { 'ACCOUNT_SHOW_READ_ONLY' } else { 'GET' }); mutation = $false; startedAtUtc = [DateTime]::UtcNow.ToString('o'); status = 'STARTED'; responseFile = $response }
  $ledger.Add($entry)
  ConvertTo-Json -InputObject @($ledger.ToArray()) -Depth 15 | Set-Content -LiteralPath $ledgerPath -Encoding utf8
  $responsePath = Join-Path $root $response
  if (Test-Path -LiteralPath $responsePath) { throw 'G3R1 response exists;refuse overwrite.' }
  $stderrPath = Join-Path $root "G3R1_$Name.stderr.txt"
  & $azurePython -IBm azure.cli @Arguments --output json --only-show-errors 1> $responsePath 2> $stderrPath
  $entry.exitCode = $LASTEXITCODE
  $entry.completedAtUtc = [DateTime]::UtcNow.ToString('o')
  $entry.responseSha256 = (Get-FileHash -LiteralPath $responsePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $entry.stderrFile = Split-Path -Leaf $stderrPath
  $entry.status = $(if ($entry.exitCode -eq 0) { 'SUCCEEDED' } else { 'FAILED' })
  ConvertTo-Json -InputObject @($ledger.ToArray()) -Depth 15 | Set-Content -LiteralPath $ledgerPath -Encoding utf8
  if ($entry.exitCode -ne 0) { Write-Warning "G3R1 read failed:$Name;preserved ledger/stderr."; return $null }
  Get-Content -LiteralPath $responsePath -Raw | ConvertFrom-Json
}
if ($PolicyDefinitionOnly) {
  $null = Read-Control 'west-europe-policy-definition' @('rest', '--method', 'get', '--url', 'https://management.azure.com/providers/Microsoft.Authorization/policyDefinitions/7509877f-d414-4d79-8d1f-d600ea78d087?api-version=2023-04-01')
  return
}
$account = Read-Control 'account' @('account', 'show', '--query', '{id:id,tenantId:tenantId,state:state}')
if (-not $account -or $account.id -ne $subscription -or $account.tenantId -ne $tenant) { throw 'G3R1 account mismatch/unreadable;no switch/login attempted.' }
$null = Read-Control 'directory-capacity' @('rest', '--method', 'get', '--url', 'https://graph.microsoft.com/beta/organization?$select=id,directorySizeQuota')
foreach ($kind in @('policyAssignments', 'denyAssignments')) {
  $url = "https://management.azure.com/subscriptions/$subscription/providers/Microsoft.Authorization/${kind}?api-version=2022-06-01"
  if ($kind -eq 'denyAssignments') { $url = $url.Replace('2022-06-01', '2022-04-01') }
  $page = 0
  while ($url) {
    $page++
    if ($page -gt 10) { throw 'G3R1 policy/deny pagination limit.' }
    $result = Read-Control "$kind-page-$page" @('rest', '--method', 'get', '--url', $url)
    if (-not $result) { break }
    $url = $result.nextLink
  }
}
Write-Host 'G3R1 GET-only directory/account controls ledger persisted;zero mutation.'
