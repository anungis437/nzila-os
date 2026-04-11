/**
 * @nzila/zonga-core — Creator Onboarding Flow (via @nzila/onboarding-core)
 *
 * Maps the CreatorOnboardingStatus enum to a structured onboarding flow
 * definition with step dependencies, validators, and progress tracking.
 *
 * @module @nzila/zonga-core/onboarding
 */

import type { OnboardingFlowDef, OnboardingStepDef } from '@nzila/onboarding-core'
import { CreatorOnboardingStatus } from './enums'

// ── Step Definitions ────────────────────────────────────────────────────────

const registrationStep: OnboardingStepDef = {
  name: CreatorOnboardingStatus.REGISTERED,
  displayName: 'Account Registration',
  required: true,
  dependsOn: [],
  validate: (data) => Boolean(data.email && data.acceptedTerms),
}

const profileStep: OnboardingStepDef = {
  name: CreatorOnboardingStatus.PROFILE_COMPLETE,
  displayName: 'Complete Creator Profile',
  required: true,
  dependsOn: [CreatorOnboardingStatus.REGISTERED],
  validate: (data) => Boolean(data.displayName && data.genre && data.bio),
}

const payoutStep: OnboardingStepDef = {
  name: CreatorOnboardingStatus.PAYOUT_READY,
  displayName: 'Set Up Payout Method',
  required: true,
  dependsOn: [CreatorOnboardingStatus.PROFILE_COMPLETE],
  validate: (data) => Boolean(data.payoutMethod && data.payoutVerified),
}

const activationStep: OnboardingStepDef = {
  name: CreatorOnboardingStatus.ACTIVE,
  displayName: 'Activate Creator Account',
  required: true,
  dependsOn: [CreatorOnboardingStatus.PAYOUT_READY],
  canStart: (data) => data.payoutVerified === true,
}

// ── Flow Definition ─────────────────────────────────────────────────────────

/**
 * The standard creator onboarding flow for the Zonga content platform.
 *
 * Steps: REGISTERED → PROFILE_COMPLETE → PAYOUT_READY → ACTIVE
 *
 * The INVITED status is handled externally (invite dispatch),
 * and SUSPENDED is a moderation status outside onboarding scope.
 */
export const CreatorOnboardingFlow: OnboardingFlowDef = {
  id: 'zonga_creator_onboarding',
  displayName: 'Zonga Creator Onboarding',
  steps: [registrationStep, profileStep, payoutStep, activationStep],
}
