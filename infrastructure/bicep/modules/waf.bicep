// ──────────────────────────────────────────────────────────────────────────────
// W1-7: Azure Front Door + WAF Policy
// Provides edge protection, DDoS mitigation, bot management, and rate limiting.
// ──────────────────────────────────────────────────────────────────────────────

param frontDoorName string
param wafPolicyName string
param enableBotProtection bool = true
param enableRateLimiting bool = true
param rateLimitThreshold int = 1000

// ── WAF Policy ──────────────────────────────────────────────────────────

resource wafPolicy 'Microsoft.Network/FrontDoorWebApplicationFirewallPolicies@2024-02-01' = {
  name: wafPolicyName
  location: 'Global'
  sku: {
    name: 'Premium_AzureFrontDoor'
  }
  properties: {
    policySettings: {
      mode: 'Prevention'
      enabledState: 'Enabled'
      requestBodyCheck: 'Enabled'
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'Microsoft_DefaultRuleSet'
          ruleSetVersion: '2.1'
          ruleSetAction: 'Block'
        }
        {
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: '1.1'
          ruleSetAction: enableBotProtection ? 'Block' : 'Log'
        }
      ]
    }
    customRules: {
      rules: concat(
        enableRateLimiting
          ? [
              {
                name: 'RateLimitPerIP'
                priority: 100
                ruleType: 'RateLimitRule'
                rateLimitDurationInMinutes: 1
                rateLimitThreshold: rateLimitThreshold
                matchConditions: [
                  {
                    matchVariable: 'RemoteAddr'
                    operator: 'IPMatch'
                    matchValue: ['0.0.0.0/0']
                  }
                ]
                action: 'Block'
              }
            ]
          : [],
        [
          {
            name: 'BlockSQLInjectionInPath'
            priority: 200
            ruleType: 'MatchRule'
            matchConditions: [
              {
                matchVariable: 'RequestUri'
                operator: 'RegEx'
                matchValue: [
                  '(\\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\\b)'
                ]
                transforms: ['Uppercase']
              }
            ]
            action: 'Block'
          }
          {
            name: 'BlockKnownBadPaths'
            priority: 300
            ruleType: 'MatchRule'
            matchConditions: [
              {
                matchVariable: 'RequestUri'
                operator: 'Contains'
                matchValue: [
                  '/wp-admin'
                  '/wp-login'
                  '/.env'
                  '/phpMyAdmin'
                  '/actuator'
                  '/.git'
                ]
              }
            ]
            action: 'Block'
          }
        ]
      )
    }
  }
}

// ── Front Door Profile ──────────────────────────────────────────────────

resource frontDoor 'Microsoft.Cdn/profiles@2024-02-01' = {
  name: frontDoorName
  location: 'Global'
  sku: {
    name: 'Premium_AzureFrontDoor'
  }
  properties: {}
}

// ── Endpoint ────────────────────────────────────────────────────────────

resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-02-01' = {
  parent: frontDoor
  name: '${frontDoorName}-endpoint'
  location: 'Global'
  properties: {
    enabledState: 'Enabled'
  }
}

// ── Security Policy (bind WAF to endpoint) ──────────────────────────────

resource securityPolicy 'Microsoft.Cdn/profiles/securityPolicies@2024-02-01' = {
  parent: frontDoor
  name: '${frontDoorName}-security'
  properties: {
    parameters: {
      type: 'WebApplicationFirewall'
      wafPolicy: {
        id: wafPolicy.id
      }
      associations: [
        {
          domains: [
            {
              id: endpoint.id
            }
          ]
          patternsToMatch: ['/*']
        }
      ]
    }
  }
}

output frontDoorEndpoint string = endpoint.properties.hostName
output wafPolicyId string = wafPolicy.id
