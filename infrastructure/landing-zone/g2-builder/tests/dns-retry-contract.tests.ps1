param(
    [Parameter(Mandatory)][string]$TemplatePath,
    [string]$BuilderDirectory = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $BuilderDirectory '..\..\..')
$proof = Get-Content -Raw (Join-Path $root '.azure\evidence\G2_NSG_RUNTIME_CANARY.json') | ConvertFrom-Json
$complement = @($proof.canaries | Where-Object label -eq 'bisect-without-dns')
if ($complement.Count -ne 1 -or $complement[0].result -ne 'PASS') {
    throw 'Missing successful runtime five-rule proof.'
}
$expectedRules = $complement[0].exactRequestBody.properties.securityRules

function Get-Resources {
    param($Template)
    foreach ($resource in $Template.resources) {
        $resource
        if ($resource.properties.template) { Get-Resources $resource.properties.template }
    }
}

function Assert-RetryContract {
    param($Template)
    $resources = @(Get-Resources $Template)
    $inner = @($resources | Where-Object type -eq 'Microsoft.Resources/deployments')[0].properties.template
    $nsg = @($resources | Where-Object type -eq 'Microsoft.Network/networkSecurityGroups')
    if ($nsg.Count -ne 1 -or $nsg[0].apiVersion -ne '2024-05-01') { throw 'NSG/API contract failed.' }
    $rules = @($nsg[0].properties.securityRules)
    if (@($rules | Where-Object {
        $_.properties.destinationAddressPrefix -eq 'AzurePlatformDNS' -and $_.properties.access -eq 'Allow'
    }).Count) { throw 'AzurePlatformDNS Allow is prohibited.' }
    if (($rules | ConvertTo-Json -Depth 30 -Compress) -cne ($expectedRules | ConvertTo-Json -Depth 30 -Compress)) {
        throw 'NSG must equal the exact runtime-proven five-rule collection.'
    }
    if (@($rules | Where-Object {
        $_.properties.direction -eq 'Inbound' -and $_.properties.access -eq 'Allow'
    }).Count) { throw 'Inbound administration is prohibited.' }
    $vm = @($resources | Where-Object type -eq 'Microsoft.Compute/virtualMachines')
    $identities = @($resources | Where-Object type -eq 'Microsoft.ManagedIdentity/userAssignedIdentities')
    if ($vm.Count -ne 1 -or $identities.Count -ne 2 -or $identities[0].name -eq $identities[1].name) {
        throw 'Distinct builder/runtime identity contract failed.'
    }
    $attached = @($vm[0].identity.userAssignedIdentities.PSObject.Properties)
    if ($attached.Count -ne 1 -or $attached[0].Name -notmatch 'builder') { throw 'Only builder UAMI may attach to VM.' }
    foreach ($nic in @($resources | Where-Object type -eq 'Microsoft.Network/networkInterfaces')) {
        foreach ($config in $nic.properties.ipConfigurations) {
            if ($config.properties.publicIPAddress) { throw 'Builder public IP is prohibited.' }
        }
    }
    $registry = @($resources | Where-Object type -eq 'Microsoft.ContainerRegistry/registries')
    if ($registry.Count -ne 1 -or $registry[0].sku.name -ne 'Premium' -or
        $registry[0].properties.publicNetworkAccess -ne 'Disabled' -or
        $registry[0].properties.adminUserEnabled -ne $false -or
        $registry[0].properties.networkRuleBypassOptions -ne 'None') { throw 'Private ACR contract failed.' }
    $egressIp = @($resources | Where-Object { $_.type -eq 'Microsoft.Network/publicIPAddresses' -and $_.name -match 'egress' })
    if ($egressIp.Count -ne 1 -or $egressIp[0].sku.name -ne 'Standard' -or
        $egressIp[0].sku.tier -ne 'Regional' -or
        $egressIp[0].properties.ddosSettings.protectionMode -ne 'VirtualNetworkInherited' -or
        $egressIp[0].properties.publicIPAllocationMethod -ne 'Static' -or
        $egressIp[0].properties.publicIPAddressVersion -ne 'IPv4') { throw 'Firewall egress public IP contract failed.' }
    $fw = @($resources | Where-Object type -eq 'Microsoft.Network/azureFirewalls')
    if ($fw.Count -ne 1 -or $fw[0].properties.applicationRuleCollections -notmatch 'length.*approvedAptSources.*0' -or
        $fw[0].properties.networkRuleCollections -or $fw[0].properties.natRuleCollections) {
        throw 'Package egress must remain fail-closed.'
    }
    $assignments = @($resources | Where-Object type -eq 'Microsoft.Authorization/roleAssignments')
    if ($assignments.Count -ne 2) { throw 'Exactly two repository roles are required.' }
    foreach ($assignment in $assignments) {
        $p = $assignment.properties
        $roleId = [string]$p.roleDefinitionId
        if ($roleId -match "variables\('([^']+)'\)") {
            $roleId = [string]$inner.variables.($Matches[1])
        }
        if ($assignment.scope -notmatch 'registry' -or $p.conditionVersion -ne '2.0' -or
            $p.condition -notmatch "StringEqualsIgnoreCase 'synthetic-health'") { throw 'Repository scope contract failed.' }
        if ($p.principalId -match 'runtime') {
            if ($roleId -ne 'b93aa761-3e63-49ed-ac28-beffa264f7ac' -or $p.condition -match 'content/write|metadata/write') {
                throw 'Runtime identity must be pull-only.'
            }
        } elseif ($p.principalId -match 'builder') {
            if ($roleId -ne '2a1e307c-b015-4ebd-883e-5b7698a07328') { throw 'Builder writer role changed.' }
        } else { throw 'Unexpected role principal.' }
    }
}

$template = Get-Content -Raw $TemplatePath | ConvertFrom-Json
Assert-RetryContract $template
$params = Get-Content -Raw (Join-Path $BuilderDirectory 'parameters.preview.json') | ConvertFrom-Json
if (@($params.parameters.approvedAptSources.value).Count) { throw 'Stage 1 package sources must be empty.' }
'PASS: exact proven five rules; no DNS Allow, inbound management, public VM IP or unrestricted outbound; private ACR; closed package egress; distinct scoped identities'

$mutations = @(
    @{
        Name = 'DNS Allow'
        Edit = {
            param($copy)
            $nsg = Get-Resources $copy | Where-Object type -eq 'Microsoft.Network/networkSecurityGroups'
            $rule = $nsg.properties.securityRules[0] | ConvertTo-Json -Depth 20 | ConvertFrom-Json
            $rule.properties.destinationAddressPrefix = 'AzurePlatformDNS'
            $nsg.properties.securityRules += $rule
        }
    },
    @{
        Name = 'Unrestricted outbound'
        Edit = {
            param($copy)
            (Get-Resources $copy | Where-Object type -eq 'Microsoft.Network/networkSecurityGroups').properties.securityRules[0].properties.destinationAddressPrefix = '*'
        }
    },
    @{
        Name = 'Inbound SSH'
        Edit = {
            param($copy)
            $rule = (Get-Resources $copy | Where-Object type -eq 'Microsoft.Network/networkSecurityGroups').properties.securityRules[3]
            $rule.properties.access = 'Allow'
            $rule.properties.destinationPortRange = '22'
        }
    },
    @{
        Name = 'Runtime push'
        Edit = {
            param($copy)
            (Get-Resources $copy | Where-Object { $_.type -eq 'Microsoft.Authorization/roleAssignments' -and $_.properties.principalId -match 'runtime' }).properties.roleDefinitionId = '2a1e307c-b015-4ebd-883e-5b7698a07328'
        }
    },
    @{
        Name = 'Unscoped builder'
        Edit = {
            param($copy)
            (Get-Resources $copy | Where-Object { $_.type -eq 'Microsoft.Authorization/roleAssignments' -and $_.properties.principalId -match 'builder' }).properties.condition = ''
        }
    }
)
foreach ($mutation in $mutations) {
    $copy = $template | ConvertTo-Json -Depth 100 | ConvertFrom-Json
    & $mutation.Edit $copy
    $rejected = $false
    try { Assert-RetryContract $copy } catch { $rejected = $true; "PASS: rejected $($mutation.Name): $($_.Exception.Message)" }
    if (-not $rejected) { throw "Mutation not detected: $($mutation.Name)" }
}
