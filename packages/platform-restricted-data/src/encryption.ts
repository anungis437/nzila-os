import type { EvidenceClass } from './types'

export interface EncryptionControl {
  control: string
  requiredForRestricted: boolean
  evidence: EvidenceClass
  configuredInCode: string
  runtimeVerified: false
  note: string
}

/**
 * No custom cryptography. Field-level encryption is not added: the standard
 * asks for column-level protection where supported, and no supported platform
 * primitive was found. Customer-managed keys remain the required at-rest
 * control and are not verified in a running environment.
 */
export function encryptionAssurance(): EncryptionControl[] {
  return [
    {
      control: 'encryption_at_rest',
      requiredForRestricted: true,
      evidence: 'CONFIG_PROVEN',
      configuredInCode: 'governance/privacy/policies/data-classification-standard.md requires AES-256 and a customer-managed key for Restricted. Staging inventory records Azure-managed keys.',
      runtimeVerified: false,
      note: 'Azure-managed keys do not satisfy the customer-managed key requirement. Running key identity is UNVERIFIED.',
    },
    {
      control: 'encryption_in_transit',
      requiredForRestricted: true,
      evidence: 'CONFIG_PROVEN',
      configuredInCode: 'Inventory entries say TLS. Version is not stated.',
      runtimeVerified: false,
      note: 'TLS version and cipher on the running endpoint are UNVERIFIED.',
    },
    {
      control: 'customer_managed_key',
      requiredForRestricted: true,
      evidence: 'UNVERIFIED',
      configuredInCode: 'infrastructure/bicep/modules/postgres.bicep does not set a customer-managed key.',
      runtimeVerified: false,
      note: 'CMK is required and not shown as configured. This is not marked compliant.',
    },
    {
      control: 'key_ownership_and_location',
      requiredForRestricted: true,
      evidence: 'UNVERIFIED',
      configuredInCode: 'packages/secrets/src/keyvault.ts retrieves secrets. It does not attest key ownership or region at runtime.',
      runtimeVerified: false,
      note: 'Key Vault sku in infrastructure/bicep/modules/keyvault.bicep is standard. Inventory HSM wording is not re-verified.',
    },
    {
      control: 'key_rotation',
      requiredForRestricted: true,
      evidence: 'CONFIG_PROVEN',
      configuredInCode: 'packages/secrets/src/rotation.ts and keyvault.bicep rotationIntervalDays default 90.',
      runtimeVerified: false,
      note: 'A rotation helper exists. A completed rotation in the running vault is UNVERIFIED.',
    },
    {
      control: 'backup_encryption',
      requiredForRestricted: true,
      evidence: 'UNVERIFIED',
      configuredInCode: 'Classification standard requires backup encryption for Confidential and Restricted. Postgres bicep enables geo-redundant backup by parameter and does not show a customer-managed backup key.',
      runtimeVerified: false,
      note: 'Backup encryption in the running account is UNVERIFIED.',
    },
    {
      control: 'field_level_encryption',
      requiredForRestricted: false,
      evidence: 'UNVERIFIED',
      configuredInCode: 'Not implemented. Custom cryptography was not added.',
      runtimeVerified: false,
      note: 'Omitted because no supported column-level primitive was found. Storage CMK remains unverified, so this omission is a limitation, not a claim that disk encryption is sufficient.',
    },
  ]
}
