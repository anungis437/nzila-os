// Union Eyes — Azure Front Door Standard + WAF (Phase B)
//
// Provisions the AFD profile, endpoint, origin group, origin, route,
// WAF policy (custom rate-limit + scanner-block rules), and security
// policy that links the WAF to the AFD endpoint.
//
// Deploy once into the production resource group:
//
//   az deployment group create \
//     --resource-group nzila-canada-prod-rg \
//     --template-file apps/union-eyes/infra/waf-afd/waf-afd.bicep \
//     --parameters acaFqdn=<aca-fqdn>
//
// Live production state (2026-05-17):
//   AFD profile    : nzila-ue-afd-prod (Standard_AzureFrontDoor)
//   AFD endpoint   : ue-prod  →  ue-prod-a7cah9hhf9dycxcc.z02.azurefd.net
//   Origin         : nzila-os-union-eyes-prod.bluesand-c3ac2d8c.canadacentral.azurecontainerapps.io
//   WAF policy     : nzilauewafdprod (Prevention, 2 custom rules)
//   Security policy: ue-prod-waf  (links WAF → endpoint, state: Succeeded)
//
// Note: Premium_AzureFrontDoor is required to add OWASP managed rule sets.
// Standard supports custom rules only (rate-limit + scanner-block provisioned here).
// Upgrade to Premium when managed OWASP 3.2 + BotManager rules are required.

targetScope = 'resourceGroup'

@description('Azure region for global AFD resources')
param location string = 'global'

@description('ACA container app FQDN (origin hostname)')
param acaFqdn string

@description('Custom domain bound to UE (e.g. app.unioneyes.app); blank to skip custom domain route')
param customDomain string = ''

var afdProfileName = 'nzila-ue-afd-prod'
var endpointName = 'ue-prod'
var originGroupName = 'ue-aca-origins'
var originName = 'ue-aca-prod'
var routeName = 'ue-prod-route'
var wafPolicyName = 'nzilauewafdprod'
var securityPolicyName = 'ue-prod-waf'

resource afdProfile 'Microsoft.Cdn/profiles@2024-02-01' = {
  name: afdProfileName
  location: location
  sku: { name: 'Standard_AzureFrontDoor' }
}

resource afdEndpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-02-01' = {
  parent: afdProfile
  name: endpointName
  location: location
  properties: {
    enabledState: 'Enabled'
  }
}

resource originGroup 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: afdProfile
  name: originGroupName
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/api/health/liveness'
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
    sessionAffinityState: 'Disabled'
  }
}

resource origin 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: originGroup
  name: originName
  properties: {
    hostName: acaFqdn
    httpPort: 80
    httpsPort: 443
    originHostHeader: acaFqdn
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

resource route 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: afdEndpoint
  name: routeName
  properties: {
    originGroup: { id: originGroup.id }
    supportedProtocols: [ 'Http', 'Https' ]
    patternsToMatch: [ '/*' ]
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
  }
  dependsOn: [ origin ]
}

resource wafPolicy 'Microsoft.Network/FrontDoorWebApplicationFirewallPolicies@2022-05-01' = {
  name: wafPolicyName
  location: location
  sku: { name: 'Standard_AzureFrontDoor' }
  properties: {
    policySettings: {
      enabledState: 'Enabled'
      mode: 'Prevention'
      requestBodyCheck: 'Enabled'
    }
    customRules: {
      rules: [
        {
          name: 'RateLimitPerIP'
          priority: 100
          ruleType: 'RateLimitRule'
          rateLimitDurationInMinutes: 1
          rateLimitThreshold: 300
          matchConditions: [
            {
              matchVariable: 'RemoteAddr'
              operator: 'IPMatch'
              negateCondition: true
              matchValue: [ '0.0.0.0/0' ]
            }
          ]
          action: 'Block'
          enabledState: 'Enabled'
        }
        {
          name: 'BlockScanners'
          priority: 200
          ruleType: 'MatchRule'
          matchConditions: [
            {
              matchVariable: 'RequestUri'
              operator: 'Contains'
              negateCondition: false
              matchValue: [ '.env', 'wp-admin', 'phpinfo', '/etc/passwd', 'xmlrpc' ]
              transforms: [ 'Lowercase' ]
            }
          ]
          action: 'Block'
          enabledState: 'Enabled'
        }
      ]
    }
  }
}

resource securityPolicy 'Microsoft.Cdn/profiles/securityPolicies@2024-02-01' = {
  parent: afdProfile
  name: securityPolicyName
  properties: {
    parameters: {
      type: 'WebApplicationFirewall'
      wafPolicy: { id: wafPolicy.id }
      associations: [
        {
          domains: [ { id: afdEndpoint.id } ]
          patternsToMatch: [ '/*' ]
        }
      ]
    }
  }
}

output afdEndpointHostname string = afdEndpoint.properties.hostName
output wafPolicyId string = wafPolicy.id
output securityPolicyState string = securityPolicy.properties.provisioningState
