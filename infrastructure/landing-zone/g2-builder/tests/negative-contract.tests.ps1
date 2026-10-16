param(
    [string]$BuilderDirectory = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

function Get-ArmResources {
    param([object]$Template)

    $found = [System.Collections.Generic.List[object]]::new()
    foreach ($resource in @($Template.resources)) {
        $found.Add($resource)
        if ($resource.properties -and $resource.properties.template) {
            foreach ($nested in @(Get-ArmResources -Template $resource.properties.template)) {
                $found.Add($nested)
            }
        }
    }
    return $found.ToArray()
}

function Get-ContractFindings {
    param([object]$Template)

    $findings = [System.Collections.Generic.List[string]]::new()
    $resources = @(Get-ArmResources -Template $Template)
    $registry = @($resources | Where-Object type -eq 'Microsoft.ContainerRegistry/registries')
    $vm = @($resources | Where-Object type -eq 'Microsoft.Compute/virtualMachines')
    $firewall = @($resources | Where-Object type -eq 'Microsoft.Network/azureFirewalls')
    $nics = @($resources | Where-Object type -eq 'Microsoft.Network/networkInterfaces')
    $assignments = @($resources | Where-Object type -eq 'Microsoft.Authorization/roleAssignments')

    if ($registry.Count -ne 1) {
        $findings.Add('Expected one isolated ACR.')
    } else {
        $p = $registry[0].properties
        if ($p.adminUserEnabled -ne $false) { $findings.Add('ACR admin credentials must be disabled.') }
        if ($p.publicNetworkAccess -ne 'Disabled') { $findings.Add('ACR public access must be disabled.') }
        if ($p.networkRuleBypassOptions -ne 'None') { $findings.Add('ACR trusted-service bypass must be disabled.') }
        if ($p.roleAssignmentMode -ne 'AbacRepositoryPermissions') { $findings.Add('ACR must use ABAC repository permissions.') }
    }

    if ($vm.Count -ne 1) {
        $findings.Add('Expected one builder VM.')
    } else {
        $version = [string]$vm[0].properties.storageProfile.imageReference.version
        if ($version -match 'latest') {
            $findings.Add('Marketplace image version must be pinned.')
        } elseif ($version -match "parameters\('([^']+)'\)") {
            $parameterName = $Matches[1]
            $parameter = $Template.parameters.$parameterName
            if (-not $parameter -or [string]$parameter.defaultValue -notmatch '^\d{2}\.\d{2}\.\d{9}$') {
                $findings.Add('Marketplace image version must be pinned.')
            }
        } elseif ($version -notmatch '^\d{4}\.\d{6}\.\d+$') {
            $findings.Add('Marketplace image version must be pinned.')
        }
    }

    foreach ($nic in $nics) {
        foreach ($configuration in @($nic.properties.ipConfigurations)) {
            if ($configuration.properties.publicIPAddress) {
                $findings.Add('Builder NIC must not have a public IP.')
            }
        }
    }

    foreach ($fw in $firewall) {
        if ($fw.sku) { $findings.Add('Azure Firewall SKU must be declared under properties.') }
        if ($fw.properties.sku.name -ne 'AZFW_VNet' -or $fw.properties.sku.tier -ne 'Basic') {
            $findings.Add('Azure Firewall must use the Basic AZFW_VNet SKU under properties.')
        }
        foreach ($collection in @($fw.properties.applicationRuleCollections)) {
            foreach ($rule in @($collection.properties.rules)) {
                foreach ($fqdn in @($rule.targetFqdns)) {
                    if ($fqdn -eq '*' -or $fqdn -match '(^|\.)\*') {
                        $findings.Add('Firewall package egress must not use wildcard FQDNs.')
                    }
                }
            }
        }
    }

    foreach ($assignment in $assignments) {
        $roleId = [string]$assignment.properties.roleDefinitionId
        if ($roleId -match 'b24988ac-6180-42a0-ab88-20f7382dd24c|8e3af657-a8ff-443c-a75c-2fe8c4bcb635') {
            $findings.Add('Builder/runtime identities must not receive Contributor or Owner.')
        }
        if ($roleId -match '2a1e307c-b015-4ebd-883e-5b7698a07328' -and $assignment.properties.condition -notmatch "StringEqualsIgnoreCase 'synthetic-health'") {
            $findings.Add('Writer role must be repository-scoped.')
        }
        if ($roleId -match 'b93aa761-3e63-49ed-ac28-beffa264f7ac' -and $assignment.properties.condition -notmatch "StringEqualsIgnoreCase 'synthetic-health'") {
            $findings.Add('Reader role must be repository-scoped.')
        }
    }

    return $findings.ToArray()
}

$compiledTemplate = Join-Path $env:TEMP "nzila-g2-builder-$PID.json"
try {
    az bicep build --file (Join-Path $BuilderDirectory 'main.bicep') --outfile $compiledTemplate
    if ($LASTEXITCODE -ne 0) { throw 'Bicep build failed.' }

    $builderSource = Get-Content -Raw -LiteralPath (Join-Path $BuilderDirectory 'builder.bicep')
    $cloudInitSource = Get-Content -Raw -LiteralPath (Join-Path $BuilderDirectory 'cloud-init.yaml')
    $discoverySource = Get-Content -Raw -LiteralPath (Join-Path $BuilderDirectory 'discovery.py')
    $previewParameters = Get-Content -Raw -LiteralPath (Join-Path $BuilderDirectory 'parameters.preview.json') | ConvertFrom-Json
    $customDataSource = "$builderSource`n$cloudInitSource`n$discoverySource"
    if ($builderSource -match 'loadFileAsBase64|loadTextContent\(''./build\.sh''\)') {
        throw 'Stage 1 Custom Data must not include the source archive or builder script.'
    }
    if ($customDataSource -match '(?i)apt-get\s+(update|install)|buildah\s+bud|docker\s+build|source\.tar|az\s+vm\s+run-command') {
        throw 'Stage 1 Custom Data must not update/install packages, build/push images, or use Run Command.'
    }
    if (@($previewParameters.parameters.approvedAptSources.value).Count -ne 0) {
        throw 'Stage 1 preview parameters must keep package egress closed.'
    }
    if ($cloudInitSource -notmatch 'discovery\.py|/dev/ttyS0' -or $discoverySource -notmatch 'NZILA_G2_STAGE1_DISCOVERY_V1') {
        throw 'Stage 1 Custom Data must run discovery and emit its marked serial proof.'
    }
    if ($discoverySource -notmatch 'tokenValuesEmitted.{0,10}False' -or $discoverySource -match 'repositoryToken.{0,80}print\(') {
        throw 'Stage 1 discovery must never emit token material.'
    }
    'PASS: Stage 1 Custom Data is discovery-only; package egress, source delivery, image build/push, and Run Command are absent'

    $template = Get-Content -Raw -LiteralPath $compiledTemplate | ConvertFrom-Json
    $baseFindings = @(Get-ContractFindings -Template $template)
    if ($baseFindings.Count -gt 0) {
        throw "Base template violates its contract: $($baseFindings -join '; ')"
    }

    $mutations = @(
        @{
            Name = 'ACR admin enabled'
            Mutate = {
                param($copy)
                (Get-ArmResources $copy | Where-Object type -eq 'Microsoft.ContainerRegistry/registries').properties.adminUserEnabled = $true
            }
            Expected = 'ACR admin credentials must be disabled.'
        }
        @{
            Name = 'ACR public origin enabled'
            Mutate = {
                param($copy)
                (Get-ArmResources $copy | Where-Object type -eq 'Microsoft.ContainerRegistry/registries').properties.publicNetworkAccess = 'Enabled'
            }
            Expected = 'ACR public access must be disabled.'
        }
        @{
            Name = 'Builder NIC public IP'
            Mutate = {
                param($copy)
                $nic = Get-ArmResources $copy | Where-Object type -eq 'Microsoft.Network/networkInterfaces' | Select-Object -First 1
                $nic.properties.ipConfigurations[0].properties | Add-Member -NotePropertyName publicIPAddress -NotePropertyValue @{ id = '/fake/public-ip' }
            }
            Expected = 'Builder NIC must not have a public IP.'
        }
        @{
            Name = 'Wildcard firewall egress'
            Mutate = {
                param($copy)
                $fw = Get-ArmResources $copy | Where-Object type -eq 'Microsoft.Network/azureFirewalls' | Select-Object -First 1
                $fw.properties.applicationRuleCollections = @(@{
                    properties = @{ rules = @(@{ targetFqdns = @('*') }) }
                })
            }
            Expected = 'Firewall package egress must not use wildcard FQDNs.'
        }
        @{
            Name = 'Unpinned marketplace image'
            Mutate = {
                param($copy)
                (Get-ArmResources $copy | Where-Object type -eq 'Microsoft.Compute/virtualMachines').properties.storageProfile.imageReference.version = 'latest'
            }
            Expected = 'Marketplace image version must be pinned.'
        }
    )

    foreach ($mutation in $mutations) {
        $copy = $template | ConvertTo-Json -Depth 100 | ConvertFrom-Json
        & $mutation.Mutate $copy
        $findings = @(Get-ContractFindings -Template $copy)
        if ($findings -notcontains $mutation.Expected) {
            throw "Negative contract test '$($mutation.Name)' was not detected."
        }
        "PASS: rejected $($mutation.Name)"
    }

    'PASS: base template satisfies static private-builder contract'
} finally {
    Remove-Item -LiteralPath $compiledTemplate -Force -ErrorAction SilentlyContinue
}
