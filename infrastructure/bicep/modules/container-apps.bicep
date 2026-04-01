// ──────────────────────────────────────────────────────────────────────────────
// W1-1: Container Apps Environment with mTLS
// Enforces mutual TLS between all container apps in the environment.
// ──────────────────────────────────────────────────────────────────────────────

param envName string
param location string
param logAnalyticsId string
@secure()
param logAnalyticsKey string
param enableMtls bool = true
param minReplicas int = 1
param maxReplicas int = 5

resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsId
        sharedKey: logAnalyticsKey
      }
    }
    peerAuthentication: {
      mtls: {
        enabled: enableMtls  // W1-1: enforce mTLS between all services
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// ── App template (parameterized per service) ──────────────────────────────

@description('Container app definitions for each Nzila service')
param apps array = [
  { name: 'nzila-os-web', image: 'nzila/web', port: 3000 }
  { name: 'nzila-os-console', image: 'nzila/console', port: 3001 }
  { name: 'nzila-os-partners', image: 'nzila/partners', port: 3002 }
  { name: 'nzila-os-union-eyes', image: 'nzila/union-eyes', port: 3003 }
]

resource containerApps 'Microsoft.App/containerApps@2024-03-01' = [
  for app in apps: {
    name: app.name
    location: location
    properties: {
      managedEnvironmentId: containerEnv.id
      configuration: {
        ingress: {
          external: true
          targetPort: app.port
          transport: 'http'
          clientCertificateMode: enableMtls ? 'require' : 'ignore'
        }
        registries: []
      }
      template: {
        containers: [
          {
            name: app.name
            image: '${app.image}:latest'
            resources: {
              cpu: json('0.5')
              memory: '1Gi'
            }
            probes: [
              {
                type: 'Liveness'
                httpGet: {
                  path: '/api/health'
                  port: app.port
                }
                periodSeconds: 30
              }
              {
                type: 'Readiness'
                httpGet: {
                  path: '/api/ready'
                  port: app.port
                }
                periodSeconds: 10
              }
            ]
          }
        ]
        scale: {
          minReplicas: minReplicas
          maxReplicas: maxReplicas
          rules: [
            {
              name: 'http-scaling'
              http: {
                metadata: {
                  concurrentRequests: '50'
                }
              }
            }
          ]
        }
      }
    }
  }
]

output environmentId string = containerEnv.id
