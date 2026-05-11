/**
 * @nzila/governance-runtime — barrel exports
 */

export type {
  ReleaseIdentity,
  EnvironmentIdentity,
  EnvironmentClass,
  DeploymentLegitimacyVerdict,
  DeploymentLegitimacyCheck,
  DeploymentLegitimacyReport,
} from './types'

export {
  releaseIdentitySchema,
  readReleaseIdentity,
  readReleaseIdentityFromEnv,
  UnknownReleaseStateError,
} from './release-identity'
export type { ReleaseIdentitySource } from './release-identity'

export {
  validateDeploymentLegitimacy,
} from './deployment-legitimacy'
export type {
  DeploymentLegitimacyInput,
  DeploymentLegitimacyOptions,
} from './deployment-legitimacy'

export {
  DoctrineViolationError,
  assertPilotIsolation,
  assertExecutiveDensity,
  assertHumanAuthority,
  assertAntiSurveillancePayload,
} from './assertions'
export type {
  DoctrineCitation,
  PilotIsolationContext,
  ExecutiveDensityContext,
  HumanAuthorityContext,
  AntiSurveillanceContext,
} from './assertions'
