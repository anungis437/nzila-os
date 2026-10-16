$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'g3r1-account-controls.ps1'
$root = Join-Path $PSScriptRoot 'g3-readiness-evidence'
$ledgerPath = Join-Path $root 'G3R1_AZURE_READ_LEDGER.json'
$before = (Get-FileHash -LiteralPath $ledgerPath -Algorithm SHA256).Hash
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($source, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'G3R1 collector parse failed.' }
$definition = $ast.Find({
  param($node)
  $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Read-Control'
}, $true)
if (-not $definition) { throw 'Read-Control policy not found.' }
. ([scriptblock]::Create($definition.Extent.Text))
$subscription = '5d819f33-d16f-429c-a3c0-5b0e94740ba3'
$base = "https://management.azure.com/subscriptions/$subscription/providers/Microsoft.Authorization/"
$cases = @(
  @{ name = 'login'; args = @('login') }
  @{ name = 'account mutation'; args = @('account', 'set', '--subscription', $subscription) }
  @{ name = 'personal account metadata'; args = @('account', 'show', '--query', 'user') }
  @{ name = 'role assignment'; args = @('role', 'assignment', 'create') }
  @{ name = 'resource deployment'; args = @('deployment', 'group', 'create') }
  @{ name = 'POST'; args = @('rest', '--method', 'post', '--url', "${base}policyAssignments?api-version=2022-06-01") }
  @{ name = 'PUT'; args = @('rest', '--method', 'put', '--url', "${base}denyAssignments?api-version=2022-04-01") }
  @{ name = 'DELETE'; args = @('rest', '--method', 'delete', '--url', "${base}denyAssignments?api-version=2022-04-01") }
  @{ name = 'Graph users'; args = @('rest', '--method', 'get', '--url', 'https://graph.microsoft.com/beta/users') }
  @{ name = 'unselected organization properties'; args = @('rest', '--method', 'get', '--url', 'https://graph.microsoft.com/beta/organization') }
  @{ name = 'external GET'; args = @('rest', '--method', 'get', '--url', 'https://example.com/') }
  @{ name = 'other subscription'; args = @('rest', '--method', 'get', '--url', 'https://management.azure.com/subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Authorization/policyAssignments?api-version=2022-06-01') }
)
foreach ($case in $cases) {
  $rejected = $false
  try { Read-Control 'invalid-offline' $case.args | Out-Null } catch {
    if ($_.Exception.Message -ne 'G3R1_ACCOUNT_READ_ALLOWLIST_ONLY') { throw }
    $rejected = $true
  }
  if (-not $rejected) { throw "Invalid command allowed:$($case.name)" }
}
& $source -ParseOnly
if ((Get-FileHash -LiteralPath $ledgerPath -Algorithm SHA256).Hash -ne $before) { throw 'Offline policy tests changed read ledger.' }
Write-Host "PASS G3R1 PowerShell parse and $($cases.Count) fail-closed read-policy cases;zero Azure calls and no ledger changes."
