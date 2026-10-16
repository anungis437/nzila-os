param(
  [Parameter(Mandatory = $true)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'

function Read-AzureJson {
  param([string[]]$Arguments)
  $text = & az @Arguments --output json --only-show-errors
  if ($LASTEXITCODE -ne 0) {
    throw "Azure read failed: az $($Arguments -join ' ')"
  }
  return ($text | ConvertFrom-Json)
}

$account = Read-AzureJson @('account', 'show')
if ($account.id -ne '5d819f33-d16f-429c-a3c0-5b0e94740ba3') {
  throw 'Unexpected subscription: refusing to capture another estate.'
}
$roles = @(Read-AzureJson @('role', 'assignment', 'list', '--all', '--include-inherited'))
$catalog = @(Read-AzureJson @('ad', 'sp', 'list', '--all',
    '--query', '[].{id:id,appId:appId,displayName:displayName,servicePrincipalType:servicePrincipalType}'))
$applications = @(Read-AzureJson @('ad', 'app', 'list', '--all',
    '--query', '[].{id:id,appId:appId,displayName:displayName,passwordCredentials:passwordCredentials[].{keyId:keyId,endDateTime:endDateTime},keyCredentials:keyCredentials[].{keyId:keyId,endDateTime:endDateTime}}'))
$principals = @()
foreach ($id in @($roles | Where-Object principalType -eq 'ServicePrincipal' | Select-Object -ExpandProperty principalId -Unique)) {
  $sp = $catalog | Where-Object id -eq $id
  if (-not $sp) {
    $principals += [ordered]@{
      objectId = $id
      lookupStatus = 'UNRESOLVED_IN_VISIBLE_ENTRA_CATALOG'
      dependencies = 'UNKNOWN_DO_NOT_REMOVE'
    }
    continue
  }
  $application = $applications | Where-Object appId -eq $sp.appId
  $owners = @()
  $federated = @()
  if ($application) {
    $owners = @(Read-AzureJson @('ad', 'app', 'owner', 'list', '--id', $application.id,
        '--query', '[].{objectId:id,displayName:displayName}'))
    $federated = @(Read-AzureJson @('ad', 'app', 'federated-credential', 'list', '--id', $application.id,
        '--query', '[].{name:name,issuer:issuer,subject:subject,audiences:audiences}'))
  }
  $principals += [ordered]@{
    objectId = $sp.id
    appId = $sp.appId
    displayName = $sp.displayName
    type = $sp.servicePrincipalType
    applicationOwners = $owners
    passwordCredentialMetadata = @($application.passwordCredentials | Where-Object { $null -ne $_ })
    certificateCredentialMetadata = @($application.keyCredentials | Where-Object { $null -ne $_ })
    federatedCredentials = $federated
    lookupStatus = 'OBSERVED'
    dependencies = 'OWNER_AND_RUNTIME_VERIFICATION_REQUIRED_DO_NOT_REMOVE'
  }
}
$apps = @(Read-AzureJson @('containerapp', 'list',
    '--query', '[].{name:name,resourceGroup:resourceGroup,identity:identity,containers:properties.template.containers[].{env:env[].{name:name,secretRef:secretRef},aiEndpoints:env[?name==`AZURE_OPENAI_ENDPOINT` || name==`AZURE_OPENAI_WHISPER_ENDPOINT` || name==`AZURE_AI_ENDPOINT` || name==`AI_PROVIDER`].{name:name,value:value},image:image},secretReferences:properties.configuration.secrets[].{name:name,keyVaultUrl:keyVaultUrl,identity:identity}}'))
$workloads = @()
foreach ($app in $apps) {
  $ai = @()
  foreach ($container in $app.containers) {
    foreach ($entry in $container.env) {
      if ($entry.name -match 'AZURE_OPENAI|AZURE_AI|AI_PROVIDER') {
        $endpoint = $container.aiEndpoints | Where-Object name -eq $entry.name
        $ai += [ordered]@{
          name = $entry.name
          secretRef = $entry.secretRef
          endpointOrProvider = $endpoint.value
        }
      }
    }
  }
  $workloads += [ordered]@{
    name = $app.name
    resourceGroup = $app.resourceGroup
    identity = $app.identity
    images = @($app.containers.image)
    aiConfiguration = $ai
    environmentVariableMetadata = @($app.containers | ForEach-Object { $_.env })
    secretReferences = @($app.secretReferences)
  }
}
$groups = @(Read-AzureJson @('group', 'list',
    '--query', '[].{name:name,location:location,tags:tags}'))
$deployments = @()
foreach ($group in $groups) {
  $history = @(Read-AzureJson @('deployment', 'group', 'list', '--resource-group', $group.name,
      '--query', '[].{name:name,provisioningState:properties.provisioningState,timestamp:properties.timestamp,templateHash:properties.templateHash,mode:properties.mode}'))
  $deployments += [ordered]@{ resourceGroup = $group.name; deployments = $history }
}
$inventory = [ordered]@{
  capturedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
  subscriptionId = $account.id
  tenantId = $account.tenantId
  scope = 'Visible subscription RBAC principals, visible workload identities and credential metadata; not all tenant application dependencies'
  tenantCatalogCounts = @{ servicePrincipals = $catalog.Count; applications = $applications.Count }
  resourceGroups = $groups
  deploymentHistoryMetadata = $deployments
  roleAssignments = @($roles | Select-Object principalId, principalType, roleDefinitionName, scope)
  subscriptionPrincipals = $principals
  userAssignedIdentities = @(Read-AzureJson @('identity', 'list',
      '--query', '[].{name:name,resourceGroup:resourceGroup,principalId:principalId,clientId:clientId}'))
  workloads = $workloads
  resources = @(Read-AzureJson @('resource', 'list',
      '--query', '[].{id:id,name:name,type:type,location:location,resourceGroup:resourceGroup,tags:tags,identity:identity}'))
  aiAccounts = @(Read-AzureJson @('cognitiveservices', 'account', 'list',
      '--query', '[?kind==`OpenAI`].{name:name,location:location,resourceGroup:resourceGroup,publicNetworkAccess:properties.publicNetworkAccess}'))
  canadianAiCandidates = @(Read-AzureJson @('cognitiveservices', 'model', 'list', '--location', 'canadacentral',
      '--query', '[?model.name==`gpt-4.1-mini` || model.name==`text-embedding-3-small` || model.name==`whisper`].{kind:kind,name:model.name,version:model.version,skuNames:model.skus[].name}'))
  limitations = @(
    'Secret values, tokens, keys and connection strings were not read or exported.',
    'Workload use is configuration evidence, not observed request/data-class evidence.',
    'Unresolved principal IDs must not be treated as removable.',
    'Owners and role scopes do not prove exercised least privilege.',
    'Resource existence does not prove IaC reconciliation or runtime gate closure.'
  )
}
$inventory | ConvertTo-Json -Depth 24 | Set-Content -LiteralPath $OutputPath -Encoding utf8
Write-Output "Captured $($roles.Count) role assignments, $($principals.Count) subscription principals and $($apps.Count) workload configurations to $OutputPath"
