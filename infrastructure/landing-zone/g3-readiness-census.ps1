param(
  [ValidateSet('Account', 'Census', 'Followup', 'NameCheck', 'RegistryMode')][string]$Stage = 'Account'
)
$ErrorActionPreference = 'Stop'
$subscription = '5d819f33-d16f-429c-a3c0-5b0e94740ba3'
$tenant = '5082b8be-b04d-4a13-b61c-b6397670177b'
$azurePython = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\python.exe'
if (-not (Test-Path -LiteralPath $azurePython)) {
  throw 'Expected installed Azure CLI interpreter unavailable;no installation attempted.'
}
$evidenceRoot = Join-Path $PSScriptRoot 'g3-readiness-evidence'
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
$ledgerPath = Join-Path $evidenceRoot 'azure-read-only-ledger.json'
$ledger = [System.Collections.Generic.List[object]]::new()
if (Test-Path -LiteralPath $ledgerPath) {
  foreach ($entry in @(Get-Content -LiteralPath $ledgerPath -Raw | ConvertFrom-Json)) {
    $ledger.Add($entry)
  }
}

function Save-Ledger {
  ConvertTo-Json -InputObject @($ledger.ToArray()) -Depth 20 |
    Set-Content -LiteralPath $ledgerPath -Encoding utf8
}

function Invoke-AzureRead {
  param([string]$Name, [string[]]$Arguments)
  $accountRead = $Arguments.Count -eq 4 -and
    $Arguments[0] -eq 'account' -and $Arguments[1] -eq 'show' -and
    $Arguments[2] -eq '--query' -and $Arguments[3] -eq '{id:id,tenantId:tenantId,state:state}'
  $restRead = $Arguments.Count -eq 5 -and
    $Arguments[0] -eq 'rest' -and $Arguments[1] -eq '--method' -and
    $Arguments[2] -eq 'get' -and $Arguments[3] -eq '--url' -and
    ($Arguments[4].StartsWith("https://management.azure.com/subscriptions/$subscription/") -or
      $Arguments[4].StartsWith('https://graph.microsoft.com/v1.0/servicePrincipals') -or
      $Arguments[4].StartsWith('https://graph.microsoft.com/v1.0/applications'))
  $nameCheckRead = $Arguments.Count -eq 7 -and
    $Arguments[0] -eq 'rest' -and $Arguments[1] -eq '--method' -and
    $Arguments[2] -eq 'post' -and $Arguments[3] -eq '--url' -and
    $Arguments[4] -eq "https://management.azure.com/subscriptions/$subscription/providers/Microsoft.KeyVault/checkNameAvailability?api-version=2024-11-01" -and
    $Arguments[5] -eq '--body'
  if ($nameCheckRead) {
    $body = $Arguments[6] | ConvertFrom-Json
    $expectedName = (Get-Content -LiteralPath (Join-Path $evidenceRoot 'G3_EXECUTION_READINESS.json') -Raw | ConvertFrom-Json).candidateNames.keyVault
    if ($body.name -ne $expectedName -or $body.type -ne 'Microsoft.KeyVault/vaults' -or
      @($body.PSObject.Properties).Count -ne 2) {
      throw 'Only the bound candidate vault name/type may be checked.'
    }
  }
  if (-not ($accountRead -or $restRead -or $nameCheckRead)) {
    throw 'Command is outside the read-only census allowlist.'
  }
  $started = [DateTime]::UtcNow.ToString('o')
  $responseName = '{0:D3}-{1}.json' -f ($ledger.Count + 1), $Name
  $entry = [ordered]@{
    name = $Name
    startedAtUtc = $started
    completedAtUtc = $null
    command = @('az') + $Arguments + @('--output', 'json', '--only-show-errors')
    httpMethod = $(if ($restRead) { 'GET' } elseif ($nameCheckRead) { 'POST_NAME_AVAILABILITY_NONMUTATING' } else { 'ACCOUNT_SHOW_READ_ONLY' })
    mutation = $false
    exitCode = $null
    status = 'STARTED'
    responseFile = $responseName
    responseSha256 = $null
    cliTransport = 'Installed Azure CLI Python entrypoint;avoids cmd.exe ampersand parsing'
  }
  $ledger.Add($entry)
  Save-Ledger
  $responsePath = Join-Path $evidenceRoot $responseName
  $errorPath = Join-Path $evidenceRoot ($responseName -replace '\.json$', '.stderr.txt')
  $entry.stderrFile = Split-Path -Leaf $errorPath
  & $azurePython -IBm azure.cli @Arguments --output json --only-show-errors 1> $responsePath 2> $errorPath
  $exitCode = $LASTEXITCODE
  $entry.exitCode = $exitCode
  $entry.completedAtUtc = [DateTime]::UtcNow.ToString('o')
  $entry.status = $(if ($exitCode -eq 0) { 'SUCCEEDED' } else { 'FAILED' })
  $entry.responseSha256 = (Get-FileHash -LiteralPath $responsePath -Algorithm SHA256).Hash.ToLowerInvariant()
  Save-Ledger
  Copy-Item -LiteralPath $responsePath -Destination (Join-Path $evidenceRoot "$Name.json")
  Copy-Item -LiteralPath $errorPath -Destination (Join-Path $evidenceRoot "$Name.stderr.txt")
  if ($exitCode -ne 0) {
    Write-Warning "Read-only Azure query failed: $Name (exit $exitCode). See ledger and stderr."
    return $null
  }
  $result = Get-Content -LiteralPath $responsePath -Raw | ConvertFrom-Json
  Write-Host "READ_ONLY_OK $Name"
  return $result
}

$account = Invoke-AzureRead 'account' @(
  'account', 'show', '--query', '{id:id,tenantId:tenantId,state:state}'
)
if (-not $account) {
  throw 'Azure account is not readable. No login, account switch or Azure mutation attempted.'
}
if ($account.id -ne $subscription -or $account.tenantId -ne $tenant) {
  throw 'Active subscription/tenant mismatch. No account switch or Azure mutation attempted.'
}
if ($Stage -eq 'Account') { return }

$base = "https://management.azure.com/subscriptions/$subscription"
function Read-Arm {
  param([string]$Name, [string]$Suffix)
  Invoke-AzureRead $Name @('rest', '--method', 'get', '--url', "$base/$Suffix")
}
if ($Stage -eq 'NameCheck') {
  $candidate = (Get-Content -LiteralPath (Join-Path $evidenceRoot 'G3_EXECUTION_READINESS.json') -Raw | ConvertFrom-Json).candidateNames.keyVault
  $body = @{ name = $candidate; type = 'Microsoft.KeyVault/vaults' } | ConvertTo-Json -Compress
  $url = "$base/providers/Microsoft.KeyVault/checkNameAvailability?api-version=2024-11-01"
  $null = Invoke-AzureRead 'g3-key-vault-global-name' @('rest', '--method', 'post', '--url', $url, '--body', $body)
  Write-Host 'Only documented non-reserving KeyVault name-availability POST performed;no resource mutation.'
  return
}
if ($Stage -eq 'RegistryMode') {
  $registry = Get-Content -LiteralPath (Join-Path $evidenceRoot 'g2-registry-detail-corrected.json') -Raw | ConvertFrom-Json
  $url = "https://management.azure.com$($registry.id)?api-version=2025-11-01"
  $result = Invoke-AzureRead 'g2-registry-mode-latest-stable' @('rest', '--method', 'get', '--url', $url)
  if (-not $result) { throw 'Latest subscription-supported stable registry GET failed;see ledger.' }
  Write-Host "Registry roleAssignmentMode: $($result.properties.roleAssignmentMode)"
  return
}
if ($Stage -eq 'Followup') {
  function Read-GraphPages {
    param([string]$Name, [string]$Url)
    $items = [System.Collections.Generic.List[object]]::new()
    $pageIndex = 0
    while ($Url) {
      $pageIndex++
      if ($pageIndex -gt 10) { throw 'Bounded Entra pagination limit reached.' }
      $page = Invoke-AzureRead "$Name-page-$pageIndex" @('rest', '--method', 'get', '--url', $Url)
      if (-not $page) { throw "Entra pagination query failed:$Name." }
      foreach ($item in $page.value) { $items.Add($item) }
      $Url = $page.'@odata.nextLink'
    }
    $result = @{ value = @($items.ToArray()); sourcePages = $pageIndex }
    $result | ConvertTo-Json -Depth 20 |
      Set-Content -LiteralPath (Join-Path $evidenceRoot "$Name.json") -Encoding utf8
    return $result
  }
  $spUrl = 'https://graph.microsoft.com/v1.0/servicePrincipals?$select=id,appId,displayName,servicePrincipalType&$top=999'
  $spPage = Read-GraphPages 'service-principals' $spUrl
  $appsUrl = 'https://graph.microsoft.com/v1.0/applications?$select=id,appId,displayName&$top=999'
  $appPage = Read-GraphPages 'deployment-applications' $appsUrl
  $assignments = Get-Content -LiteralPath (Join-Path $evidenceRoot 'role-assignments.json') -Raw | ConvertFrom-Json
  $candidateIds = @($assignments.value |
    Where-Object { $_.properties.principalType -eq 'ServicePrincipal' } |
    ForEach-Object { $_.properties.principalId } | Select-Object -Unique)
  foreach ($sp in @($spPage.value | Where-Object { $_.id -in $candidateIds })) {
    $app = $appPage.value | Where-Object { $_.appId -eq $sp.appId }
    if ($app) {
      $url = "https://graph.microsoft.com/v1.0/applications/$($app.id)/federatedIdentityCredentials"
      $null = Invoke-AzureRead "federation-$($sp.id)" @('rest', '--method', 'get', '--url', $url)
    }
  }
  $networks = Get-Content -LiteralPath (Join-Path $evidenceRoot 'vnets.json') -Raw | ConvertFrom-Json
  foreach ($vnet in $networks.value | Where-Object { $_.name -like 'nzila-g2-*' }) {
    $suffix = $vnet.id.Substring("/subscriptions/$subscription/".Length)
    $null = Read-Arm 'g2-peering-corrected' "$suffix/virtualNetworkPeerings?api-version=2024-05-01"
  }
  $firewalls = Get-Content -LiteralPath (Join-Path $evidenceRoot 'firewalls.json') -Raw | ConvertFrom-Json
  foreach ($firewall in $firewalls.value) {
    if ($firewall.properties.firewallPolicy.id) {
      $suffix = $firewall.properties.firewallPolicy.id.Substring("/subscriptions/$subscription/".Length)
      $null = Read-Arm 'g2-firewall-policy' "$suffix`?api-version=2024-05-01"
      $null = Read-Arm 'g2-firewall-rule-groups' "$suffix/ruleCollectionGroups?api-version=2024-05-01"
    }
  }
  $registries = Get-Content -LiteralPath (Join-Path $evidenceRoot 'registries.json') -Raw | ConvertFrom-Json
  foreach ($registry in $registries.value | Where-Object { $_.name -like 'nzilag2*' }) {
    $suffix = $registry.id.Substring("/subscriptions/$subscription/".Length)
    $null = Read-Arm 'g2-registry-detail-corrected' "$suffix`?api-version=2025-04-01"
  }
  $null = Read-Arm 'deleted-key-vaults' 'providers/Microsoft.KeyVault/deletedVaults?api-version=2023-07-01'
  Write-Host 'Followup ended. Every Azure/Entra request was GET;no credentials or user profiles queried.'
  return
}
foreach ($provider in @(
  'Microsoft.App', 'Microsoft.ContainerRegistry', 'Microsoft.ManagedIdentity',
  'Microsoft.Network', 'Microsoft.KeyVault', 'Microsoft.OperationalInsights',
  'Microsoft.Insights', 'Microsoft.Authorization'
)) {
  $null = Read-Arm "provider-$provider" "providers/$provider`?api-version=2021-04-01"
}
$resources = Read-Arm 'resources' 'resources?api-version=2021-04-01'
$null = Read-Arm 'resource-groups' 'resourcegroups?api-version=2021-04-01'
$null = Read-Arm 'g3-resource-group' 'resourcegroups/nzila-shared-test-g3-001-rg?api-version=2021-04-01'
$null = Read-Arm 'aca-regional-usage' 'providers/Microsoft.App/locations/canadacentral/usages?api-version=2025-07-01'
$null = Read-Arm 'aca-subscription-usage' 'providers/Microsoft.App/usages?api-version=2025-07-01'
$null = Read-Arm 'network-regional-usage' 'providers/Microsoft.Network/locations/canadacentral/usages?api-version=2024-05-01'
$null = Read-Arm 'compute-regional-usage' 'providers/Microsoft.Compute/locations/canadacentral/usages?api-version=2024-03-01'
$null = Read-Arm 'aca-workload-profile-support' 'providers/Microsoft.App/locations/canadacentral/availableManagedEnvironmentsWorkloadProfileTypes?api-version=2025-07-01'
$null = Read-Arm 'vnets' 'providers/Microsoft.Network/virtualNetworks?api-version=2024-05-01'
$null = Read-Arm 'firewalls' 'providers/Microsoft.Network/azureFirewalls?api-version=2024-05-01'
$null = Read-Arm 'route-tables' 'providers/Microsoft.Network/routeTables?api-version=2024-05-01'
$null = Read-Arm 'private-endpoints' 'providers/Microsoft.Network/privateEndpoints?api-version=2024-05-01'
$null = Read-Arm 'private-dns-zones' 'providers/Microsoft.Network/privateDnsZones?api-version=2020-06-01'
$null = Read-Arm 'managed-identities' 'providers/Microsoft.ManagedIdentity/userAssignedIdentities?api-version=2023-01-31'
$null = Read-Arm 'role-assignments' 'providers/Microsoft.Authorization/roleAssignments?api-version=2022-04-01'
$null = Read-Arm 'role-definitions' 'providers/Microsoft.Authorization/roleDefinitions?api-version=2022-04-01'
$null = Read-Arm 'registries' 'providers/Microsoft.ContainerRegistry/registries?api-version=2023-07-01'
$null = Read-Arm 'key-vaults' 'providers/Microsoft.KeyVault/vaults?api-version=2023-07-01'
$null = Read-Arm 'log-workspaces' 'providers/Microsoft.OperationalInsights/workspaces?api-version=2023-09-01'
$null = Read-Arm 'aca-environments' 'providers/Microsoft.App/managedEnvironments?api-version=2025-07-01'
$null = Read-Arm 'aca-apps' 'providers/Microsoft.App/containerApps?api-version=2025-07-01'
if ($resources.nextLink) {
  throw 'Resource inventory is paginated: full collision assessment remains blocked until remaining GET pages are collected.'
}
Write-Host 'Census ended. Every request was account-show or ARM GET;no Azure mutations authorized.'
