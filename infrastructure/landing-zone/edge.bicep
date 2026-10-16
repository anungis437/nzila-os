targetScope = 'resourceGroup'
@allowed(['union-eyes', 'cora'])
param product string
@allowed(['development', 'integration-test', 'staging', 'production'])
param environment string
@minLength(1)
param owner string
@minLength(1)
param costCenter string
@allowed(['product-runtime', 'infrastructure-proof'])
param purpose string
param managedEnvironmentId string
param originHost string
param readinessPath string
param operationsWorkspaceId string
param securityWorkspaceId string
@allowed(['canadacentral'])
param privateLinkLocation string = 'canadacentral'

var naming = loadJsonContent('naming.json')
var prefix = 'nzila-${product}-${naming.environmentCodes[environment]}'
var endpointName = '${prefix}-${uniqueString(resourceGroup().id)}'
var tags = {
  product: product
  environment: environment
  service: 'edge'
  purpose: purpose
  owner: owner
  cost_center: costCenter
  data_classification: 'confidential'
}
resource profile 'Microsoft.Cdn/profiles@2024-02-01' = {
  name: '${prefix}-afd'
  location: 'global'
  tags: tags
  sku: {name: 'Premium_AzureFrontDoor'}
}
resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-02-01' = {
  parent: profile
  name: endpointName
  location: 'global'
  tags: tags
  properties: {enabledState: 'Enabled'}
}
resource origins 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: profile
  name: '${product}-origins'
  properties: {
    healthProbeSettings: {
      probePath: readinessPath
      probeProtocol: 'Https'
      probeRequestType: 'GET'
      probeIntervalInSeconds: 30
    }
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
  }
}
resource origin 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: origins
  name: product
  properties: {
    hostName: originHost
    originHostHeader: originHost
    httpsPort: 443
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
    sharedPrivateLinkResource: {
      privateLink: {id: managedEnvironmentId}
      groupId: 'managedEnvironments'
      privateLinkLocation: privateLinkLocation
      requestMessage: '${prefix}: approved institutional private origin'
    }
  }
}
resource route 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: endpoint
  name: product
  properties: {
    originGroup: {id: origins.id}
    patternsToMatch: ['/*']
    supportedProtocols: ['Https']
    forwardingProtocol: 'HttpsOnly'
    httpsRedirect: 'Disabled'
    linkToDefaultDomain: 'Enabled'
    enabledState: 'Enabled'
  }
  dependsOn: [origin]
}
resource waf 'Microsoft.Network/frontdoorWebApplicationFirewallPolicies@2024-02-01' = {
  name: replace('${prefix}waf', '-', '')
  location: 'global'
  tags: tags
  sku: {name: 'Premium_AzureFrontDoor'}
  properties: {
    policySettings: {
      enabledState: 'Enabled'
      mode: 'Prevention'
      requestBodyCheck: 'Enabled'
    }
    managedRules: {
      managedRuleSets: [
        {ruleSetType: 'Microsoft_DefaultRuleSet', ruleSetVersion: '2.1', ruleSetAction: 'Block'}
        {ruleSetType: 'Microsoft_BotManagerRuleSet', ruleSetVersion: '1.0'}
      ]
    }
  }
}
resource security 'Microsoft.Cdn/profiles/securityPolicies@2024-02-01' = {
  parent: profile
  name: '${product}-waf'
  properties: {
    parameters: {
      type: 'WebApplicationFirewall'
      wafPolicy: {id: waf.id}
      associations: [
        {domains: [{id: endpoint.id}], patternsToMatch: ['/*']}
      ]
    }
  }
}
resource accessLogs 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'edge-operations'
  scope: profile
  properties: {
    workspaceId: operationsWorkspaceId
    logs: [
      {category: 'FrontDoorAccessLog', enabled: true}
      {category: 'FrontDoorHealthProbeLog', enabled: true}
    ]
    metrics: [{category: 'AllMetrics', enabled: true}]
  }
}
resource securityLogs 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'edge-security'
  scope: profile
  properties: {
    workspaceId: securityWorkspaceId
    logs: [{category: 'FrontDoorWebApplicationFirewallLog', enabled: true}]
  }
}
output endpointHost string = endpoint.properties.hostName
