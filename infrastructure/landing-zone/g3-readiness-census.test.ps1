$ErrorActionPreference = 'Stop'
$sourcePath = Join-Path $PSScriptRoot 'g3-readiness-census.ps1'
$evidenceRoot = Join-Path $PSScriptRoot 'g3-readiness-evidence'
$ledgerPath = Join-Path $evidenceRoot 'azure-read-only-ledger.json'
$ledgerBefore = (Get-FileHash -LiteralPath $ledgerPath -Algorithm SHA256).Hash
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($sourcePath, [ref]$tokens, [ref]$errors)
if ($errors.Count -ne 0) { throw "Collector has $($errors.Count) syntax errors." }
$definition = $ast.Find({
  param($node)
  $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-AzureRead'
}, $true)
if (-not $definition) { throw 'Collector read policy function not found.' }
. ([scriptblock]::Create($definition.Extent.Text))
$subscription = '5d819f33-d16f-429c-a3c0-5b0e94740ba3'
$azurePython = 'G3_AZURE_EXECUTION_MUST_NOT_OCCUR'
function Save-Ledger { throw 'Read policy permitted a forbidden command.' }
$nameCheck = "https://management.azure.com/subscriptions/$subscription/providers/Microsoft.KeyVault/checkNameAvailability?api-version=2024-11-01"
$vaultName = (Get-Content -LiteralPath (Join-Path $evidenceRoot 'G3_EXECUTION_READINESS.json') -Raw | ConvertFrom-Json).candidateNames.keyVault
$cases = @(
  @{ name = 'deployment'; args = @('deployment', 'group', 'create') }
  @{ name = 'account switch'; args = @('account', 'set', '--subscription', $subscription) }
  @{ name = 'account personal metadata'; args = @('account', 'show', '--query', 'user') }
  @{ name = 'provider registration'; args = @('provider', 'register', '--namespace', 'Microsoft.App') }
  @{ name = 'role assignment'; args = @('role', 'assignment', 'create') }
  @{ name = 'registry import'; args = @('acr', 'import') }
  @{ name = 'REST delete'; args = @('rest', '--method', 'delete', '--url', $nameCheck) }
  @{ name = 'REST put'; args = @('rest', '--method', 'put', '--url', $nameCheck) }
  @{ name = 'unapproved POST'; args = @('rest', '--method', 'post', '--url', "$nameCheck/other", '--body', '{}') }
  @{ name = 'external GET'; args = @('rest', '--method', 'get', '--url', 'https://example.com/') }
  @{ name = 'other subscription GET'; args = @('rest', '--method', 'get', '--url', 'https://management.azure.com/subscriptions/00000000-0000-0000-0000-000000000000/providers') }
  @{ name = 'unbound vault name'; args = @('rest', '--method', 'post', '--url', $nameCheck, '--body', '{"name":"unbound","type":"Microsoft.KeyVault/vaults"}') }
  @{ name = 'wrong resource type'; args = @('rest', '--method', 'post', '--url', $nameCheck, '--body', (@{ name = $vaultName; type = 'Microsoft.Storage/storageAccounts' } | ConvertTo-Json -Compress)) }
  @{ name = 'extra POST body property'; args = @('rest', '--method', 'post', '--url', $nameCheck, '--body', (@{ name = $vaultName; type = 'Microsoft.KeyVault/vaults'; extra = 'forbidden' } | ConvertTo-Json -Compress)) }
)
foreach ($case in $cases) {
  $blocked = $false
  try {
    Invoke-AzureRead 'offline-forbidden-command' $case.args | Out-Null
  } catch {
    if ($_.Exception.Message -notin @('Command is outside the read-only census allowlist.', 'Only the bound candidate vault name/type may be checked.')) { throw }
    $blocked = $true
  }
  if (-not $blocked) { throw "Command was not rejected: $($case.name)" }
}
$invalidStageBlocked = $false
try {
  & $sourcePath -Stage Execute
} catch [System.Management.Automation.ParameterBindingException] {
  $invalidStageBlocked = $true
}
if (-not $invalidStageBlocked) { throw 'Execution stage was not rejected during parameter binding.' }
if ((Get-FileHash -LiteralPath $ledgerPath -Algorithm SHA256).Hash -ne $ledgerBefore) {
  throw 'Offline tests altered the live read ledger.'
}
Write-Host "PASS PowerShell AST and $($cases.Count + 1) fail-closed command/stage checks;no Azure calls or ledger changes."
