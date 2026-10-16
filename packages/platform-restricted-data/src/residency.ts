import type { EvidenceClass } from './types'

export interface ResidencyClaim {
  id: string
  environment: 'staging' | 'production' | 'dev' | 'unspecified'
  region: string | null
  crossBorder: boolean | null
  evidence: EvidenceClass
  source: string
  note: string
}

/**
 * Claims below are readings of committed files. They are CONFIG_PROVEN as
 * documents. They are not RUNTIME_VERIFIED against Azure, and drift is unknown.
 */
export function residencyClaims(): ResidencyClaim[] {
  return [
    {
      id: 'nzila-staging-db',
      environment: 'staging',
      region: 'canadacentral',
      crossBorder: false,
      evidence: 'CONFIG_PROVEN',
      source: 'governance/privacy/data-inventory.json',
      note: 'Inventory says Azure PostgreSQL Flexible, Canada Central, Azure-managed encryption. Not a live probe.',
    },
    {
      id: 'nzilacanadastore',
      environment: 'staging',
      region: 'canadacentral',
      crossBorder: false,
      evidence: 'CONFIG_PROVEN',
      source: 'governance/privacy/data-inventory.json',
      note: 'Inventory says Azure Storage, Canada Central. Not a live probe.',
    },
    {
      id: 'nzila-staging-kv',
      environment: 'staging',
      region: 'canadacentral',
      crossBorder: false,
      evidence: 'CONFIG_PROVEN',
      source: 'governance/privacy/data-inventory.json',
      note: 'Inventory says Key Vault Canada Central, Azure-managed HSM-backed. Bicep sku is standard, not HSM. Conflict is unresolved.',
    },
    {
      id: 'azure-openai-eastus',
      environment: 'staging',
      region: 'eastus',
      crossBorder: true,
      evidence: 'CONFIG_PROVEN',
      source: 'governance/privacy/data-inventory.json',
      note: 'Cross-border from the Canada Central rule. Restricted processing is denied.',
    },
    {
      id: 'azure-openai-eastus2-whisper',
      environment: 'staging',
      region: 'eastus2',
      crossBorder: true,
      evidence: 'CONFIG_PROVEN',
      source: 'governance/privacy/data-inventory.json',
      note: 'Inventory highest tier is Restricted and crossBorder is true. That conflicts with the Canada Central rule. Processing stays denied.',
    },
    {
      id: 'unioneyes-prod-db',
      environment: 'production',
      region: 'canadacentral',
      crossBorder: null,
      evidence: 'CONFIG_PROVEN',
      source: 'packages/automation/data/azure_resources.json',
      note: 'A checked-in resource list names this server in canadacentral. Capture time is unknown. The script host nzila-os-union-eyes-prod-db is a different name and has no region. Not runtime verified.',
    },
    {
      id: 'psql-union-claims-dev-4x25',
      environment: 'dev',
      region: 'eastus2',
      crossBorder: true,
      evidence: 'CONFIG_PROVEN',
      source: 'packages/automation/data/azure_resources.json',
      note: 'The same snapshot lists a Postgres server in eastus2. Platform location is not uniformly Canada Central.',
    },
    {
      id: 'bicep-postgres-location',
      environment: 'unspecified',
      region: null,
      crossBorder: null,
      evidence: 'CONFIG_PROVEN',
      source: 'infrastructure/bicep/main.bicep',
      note: 'Location is resourceGroup().location. The template does not itself prove a running region.',
    },
  ]
}

export function restrictedResidencyAllowsProcessing(storeId: string): {
  allowed: false
  evidence: EvidenceClass
  reason: string
} {
  const claim = residencyClaims().find((item) => item.id === storeId)
  return {
    allowed: false,
    evidence: claim?.evidence ?? 'UNVERIFIED',
    reason: claim
      ? `Store "${storeId}" is ${claim.evidence} only (${claim.note}) Restricted processing is not authorized from config.`
      : `Store "${storeId}" has no residency claim. Restricted processing is denied.`,
  }
}
