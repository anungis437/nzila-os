param(
    [Parameter(Mandatory)][string]$TemplatePath,
    [Parameter(Mandatory)][string]$ParametersPath,
    [Parameter(Mandatory)][string]$BaselinePath
)

$ErrorActionPreference = 'Stop'
function Get-Resources($template) {
    foreach ($resource in $template.resources) {
        $resource
        if ($resource.properties.template) { Get-Resources $resource.properties.template }
    }
}

function Assert-Correction($template, $parameters, $baseline) {
    $resources = @(Get-Resources $template)
    $vm = @($resources | Where-Object type -eq 'Microsoft.Compute/virtualMachines')
    if ($vm.Count -ne 1) { throw 'Exactly one VM required.' }
    $linux = $vm[0].properties.osProfile.linuxConfiguration
    if ($linux.disablePasswordAuthentication -ne $true -or $vm[0].properties.osProfile.adminPassword) {
        throw 'Password authentication prohibited.'
    }
    $keys = @($linux.ssh.publicKeys)
    if ($keys.Count -ne 1 -or $keys[0].keyData -cne "[parameters('provisioningSshPublicKey')]" -or
        $keys[0].path -cne "[format('/home/{0}/.ssh/authorized_keys', variables('adminUsername'))]") { throw 'One correctly plumbed SSH public key required.' }
    $key = $parameters.parameters.provisioningSshPublicKey.value
    if ($key -notmatch '^ssh-rsa ([A-Za-z0-9+/]+={0,2})(?: .*)?$') { throw 'RSA public key required.' }
    $bytes = [Convert]::FromBase64String($Matches[1])
    $offset = 0
    $fields = @()
    while ($offset -lt $bytes.Length) {
        if ($offset + 4 -gt $bytes.Length) { throw 'Truncated SSH key.' }
        $length = [int]($bytes[$offset] * 16777216 + $bytes[$offset+1] * 65536 + $bytes[$offset+2] * 256 + $bytes[$offset+3])
        $offset += 4
        if ($length -le 0 -or $offset + $length -gt $bytes.Length) { throw 'Invalid SSH key field.' }
        $fields += ,$bytes[$offset..($offset+$length-1)]
        $offset += $length
    }
    if ($fields.Count -ne 3 -or [Text.Encoding]::ASCII.GetString($fields[0]) -ne 'ssh-rsa' -or
        $fields[2].Length -lt 512) { throw 'Strong valid RSA key required.' }
    $fw = @($resources | Where-Object type -eq 'Microsoft.Network/azureFirewalls')
    if ($fw.Count -ne 1 -or $fw[0].properties.sku.tier -ne 'Basic') { throw 'Basic firewall required.' }
    $data = @($fw[0].properties.ipConfigurations)
    $mgmt = $fw[0].properties.managementIpConfiguration
    if ($data.Count -ne 1 -or $data[0].properties.subnet.id -notmatch '/subnets/AzureFirewallSubnet' -or
        $data[0].properties.publicIPAddress.id -notmatch 'nzila-g2-egress-' -or
        $mgmt.properties.subnet.id -notmatch '/subnets/AzureFirewallManagementSubnet' -or
        $mgmt.properties.publicIPAddress.id -notmatch 'nzila-g2-fw-management-' -or
        $data[0].properties.publicIPAddress.id -eq $mgmt.properties.publicIPAddress.id) { throw 'Distinct data/management configurations required.' }
    $ips = @($resources | Where-Object type -eq 'Microsoft.Network/publicIPAddresses')
    if ($ips.Count -ne 2) { throw 'Exactly two firewall public IPs required.' }
    foreach ($ip in $ips) {
        if ($ip.sku.name -ne 'Standard' -or $ip.sku.tier -ne 'Regional' -or
            $ip.properties.publicIPAllocationMethod -ne 'Static' -or $ip.location -cne "[parameters('location')]") {
            throw 'Standard static regional firewall IP required.'
        }
    }
    $vnet = @($resources | Where-Object type -eq 'Microsoft.Network/virtualNetworks')[0]
    if ($vnet.properties.privateEndpointVNetPolicies -ne 'Disabled') {
        throw 'Exact live VNet private-endpoint policy must be preserved.'
    }
    $subnets = @($vnet.properties.subnets)
    foreach ($existing in $baseline.vnet.subnets) {
        $match = @($subnets | Where-Object name -eq $existing.name)
        if ($match.Count -ne 1 -or $match[0].properties.addressPrefix -ne $existing.addressPrefix) { throw 'Existing subnet changed.' }
    }
    $management = @($subnets | Where-Object name -eq 'AzureFirewallManagementSubnet')
    if ($subnets.Count -ne $baseline.vnet.subnets.Count + 1 -or $management.Count -ne 1 -or
        $management[0].properties.addressPrefix -ne '10.90.0.64/26' -or
        $management[0].properties.routeTable -or $management[0].properties.networkSecurityGroup) { throw 'Isolated /26 management subnet required.' }
    foreach ($nic in @($resources | Where-Object type -eq 'Microsoft.Network/networkInterfaces')) {
        if ($nic.properties.auxiliaryMode -ne 'None' -or $nic.properties.auxiliarySku -ne 'None' -or
            $nic.properties.disableTcpStateTracking -ne $false) { throw 'Exact live NIC scalar state must be preserved.' }
        foreach ($config in $nic.properties.ipConfigurations) {
            if ($config.properties.privateIPAllocationMethod -ne 'Dynamic' -or
                $config.properties.privateIPAddressVersion -ne 'IPv4' -or $config.properties.privateIPAddress) {
                throw 'Dynamic IPv4 must remain provider assigned, without address pinning.'
            }
            if ($config.properties.publicIPAddress -or $config.properties.subnet.id -match 'ManagementSubnet') { throw 'No public/management NIC path allowed.' }
        }
    }
    foreach ($pe in @($resources | Where-Object type -eq 'Microsoft.Network/privateEndpoints')) {
        if ($pe.properties.subnet.id -match 'ManagementSubnet') { throw 'No management-subnet private endpoint.' }
    }
    $nsg = @($resources | Where-Object type -eq 'Microsoft.Network/networkSecurityGroups')[0]
    if (@($nsg.properties.securityRules | Where-Object { $_.properties.direction -eq 'Inbound' -and $_.properties.access -eq 'Allow' }).Count) { throw 'No inbound administration.' }
    if (@($resources | Where-Object { $_.type -match 'bastion|runCommands|virtualMachines/extensions' }).Count) { throw 'No administration dependency.' }
}

$template = Get-Content -Raw $TemplatePath | ConvertFrom-Json
$parameters = Get-Content -Raw $ParametersPath | ConvertFrom-Json
$baseline = Get-Content -Raw $BaselinePath | ConvertFrom-Json
Assert-Correction $template $parameters $baseline
'PASS: VM public-key-only/no reachable admin; Basic management /26 and dedicated IP; existing CIDRs preserved'
$mutations = @(
    @{ Name = 'password enabled'; Edit = { param($r) ($r | Where-Object type -eq 'Microsoft.Compute/virtualMachines').properties.osProfile.linuxConfiguration.disablePasswordAuthentication = $false } },
    @{ Name = 'empty keys'; Edit = { param($r) ($r | Where-Object type -eq 'Microsoft.Compute/virtualMachines').properties.osProfile.linuxConfiguration.ssh.publicKeys = @() } },
    @{ Name = 'missing management configuration'; Edit = { param($r) ($r | Where-Object type -eq 'Microsoft.Network/azureFirewalls').properties.PSObject.Properties.Remove('managementIpConfiguration') } },
    @{ Name = 'shared public IP'; Edit = { param($r) $f = $r | Where-Object type -eq 'Microsoft.Network/azureFirewalls'; $f.properties.managementIpConfiguration.properties.publicIPAddress.id = $f.properties.ipConfigurations[0].properties.publicIPAddress.id } },
    @{ Name = 'undersized subnet'; Edit = { param($r) (($r | Where-Object type -eq 'Microsoft.Network/virtualNetworks').properties.subnets | Where-Object name -eq 'AzureFirewallManagementSubnet').properties.addressPrefix = '10.90.0.64/27' } },
    @{ Name = 'existing CIDR changed'; Edit = { param($r) ($r | Where-Object type -eq 'Microsoft.Network/virtualNetworks').properties.subnets[0].properties.addressPrefix = '10.90.3.0/26' } },
    @{ Name = 'VNet policy changed'; Edit = { param($r) ($r | Where-Object type -eq 'Microsoft.Network/virtualNetworks').properties.privateEndpointVNetPolicies = 'Basic' } },
    @{ Name = 'TCP state tracking disabled'; Edit = { param($r) ($r | Where-Object type -eq 'Microsoft.Network/networkInterfaces').properties.disableTcpStateTracking = $true } },
    @{ Name = 'dynamic IP pinned'; Edit = { param($r) ($r | Where-Object type -eq 'Microsoft.Network/networkInterfaces').properties.ipConfigurations[0].properties | Add-Member -NotePropertyName privateIPAddress -NotePropertyValue '10.90.1.4' } },
    @{ Name = 'allocation changed to static'; Edit = { param($r) ($r | Where-Object type -eq 'Microsoft.Network/networkInterfaces').properties.ipConfigurations[0].properties.privateIPAllocationMethod = 'Static' } }
)
foreach ($mutation in $mutations) {
    $copy = $template | ConvertTo-Json -Depth 100 | ConvertFrom-Json
    & $mutation.Edit @(Get-Resources $copy)
    $rejected = $false
    try { Assert-Correction $copy $parameters $baseline } catch { $rejected = $true }
    if (-not $rejected) { throw "Undetected mutation: $($mutation.Name)" }
    "PASS: rejected $($mutation.Name)"
}
