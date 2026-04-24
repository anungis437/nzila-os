import type { ProfileTargetMap, ProfileTargets, SeedProfile } from './types'
import { SEED_PROFILES } from './types'

/**
 * Per-profile volume + intensity targets.
 *
 * These are the *defaults* shared fakers and per-app seeders consult.
 * Per-app seeders may scale further (e.g. union-eyes members go to 25k
 * for executive-showcase).
 */
export const PROFILE_TARGETS: ProfileTargetMap = {
  'demo-light': {
    people: 50,
    organizations: 3,
    users: 12,
    invoices: 30,
    tickets: 20,
    events: 8,
    notifications: 25,
    activityLogs: 100,
    dashboardIntensity: 0.35,
    historyMonths: 3,
    futureWindowDays: 14,
  },
  'demo-standard': {
    people: 250,
    organizations: 5,
    users: 35,
    invoices: 150,
    tickets: 90,
    events: 20,
    notifications: 120,
    activityLogs: 600,
    dashboardIntensity: 0.6,
    historyMonths: 12,
    futureWindowDays: 30,
  },
  'executive-showcase': {
    people: 2_500,
    organizations: 8,
    users: 120,
    invoices: 1_200,
    tickets: 450,
    events: 60,
    notifications: 800,
    activityLogs: 5_000,
    dashboardIntensity: 0.85,
    historyMonths: 18,
    futureWindowDays: 60,
  },
  'investor-showcase': {
    people: 6_000,
    organizations: 12,
    users: 240,
    invoices: 3_500,
    tickets: 900,
    events: 120,
    notifications: 1_600,
    activityLogs: 12_000,
    dashboardIntensity: 1,
    historyMonths: 24,
    futureWindowDays: 90,
  },
}

export function isSeedProfile(value: unknown): value is SeedProfile {
  return typeof value === 'string' && (SEED_PROFILES as readonly string[]).includes(value)
}

export function getProfileTargets(profile: SeedProfile): ProfileTargets {
  return PROFILE_TARGETS[profile]
}

export const DEFAULT_PROFILE: SeedProfile = 'demo-standard'
