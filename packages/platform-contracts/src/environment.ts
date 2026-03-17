/**
 * Environment Contract — canonical interface for environment configuration.
 *
 * Defines the environment shape that apps declare and the platform validates.
 */

export type EnvironmentTier = 'development' | 'staging' | 'production'

export interface EnvironmentVariable {
  name: string
  required: boolean
  sensitive: boolean
  description: string
}

export interface EnvironmentDeclaration {
  app: string
  tier: EnvironmentTier
  variables: EnvironmentVariable[]
  feature_flags: string[]
}

export interface EnvironmentContract {
  declare(): EnvironmentDeclaration
  validate(): { valid: boolean; missing: string[]; warnings: string[] }
}
