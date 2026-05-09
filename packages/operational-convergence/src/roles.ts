/**
 * Shared Role Experience Model
 *
 * Doctrine: docs/nzila-operational-convergence/shared-role-experience-model.md
 */
import type { CanonicalGroup } from './ia'

export const CANONICAL_ROLES = [
  'executive',
  'governance-operator',
  'deployment-operator',
  'continuity-reviewer',
  'pilot-operator',
  'administrator',
  'steward',
  'reviewer',
  'procurement-observer',
] as const
export type CanonicalRole = (typeof CANONICAL_ROLES)[number]

export interface RoleExperience {
  readonly role: CanonicalRole
  readonly primarySurfaces: readonly string[]
  readonly visibleGroups: readonly CanonicalGroup[]
  readonly cognitiveLoad: 'one-screen' | 'few-surfaces' | 'extended-session'
  readonly refusedContent: readonly string[]
}

const ROLE_EXPERIENCES: Readonly<Record<CanonicalRole, RoleExperience>> = {
  executive: {
    role: 'executive',
    primarySurfaces: ['/governance', '/priority'],
    visibleGroups: ['priority', 'outcomes', 'intelligence', 'governance'],
    cognitiveLoad: 'one-screen',
    refusedContent: ['engineering jargon', 'telemetry density', 'composite scores'],
  },
  'governance-operator': {
    role: 'governance-operator',
    primarySurfaces: ['/governance/review', '/governance/continuity'],
    visibleGroups: ['work', 'governance', 'evidence', 'attestations'],
    cognitiveLoad: 'few-surfaces',
    refusedContent: ['person-resolving content'],
  },
  'deployment-operator': {
    role: 'deployment-operator',
    primarySurfaces: ['/governance/legitimacy', '/rollout'],
    visibleGroups: ['work', 'rollout', 'governance', 'attestations'],
    cognitiveLoad: 'few-surfaces',
    refusedContent: ['composite verdict scoring'],
  },
  'continuity-reviewer': {
    role: 'continuity-reviewer',
    primarySurfaces: ['/governance/continuity', '/governance/stabilization'],
    visibleGroups: ['work', 'governance', 'intelligence'],
    cognitiveLoad: 'few-surfaces',
    refusedContent: ['person-scoped continuity'],
  },
  'pilot-operator': {
    role: 'pilot-operator',
    primarySurfaces: ['/work', '/governance'],
    visibleGroups: ['work', 'governance', 'evidence'],
    cognitiveLoad: 'few-surfaces',
    refusedContent: ['cross-pilot exposure'],
  },
  administrator: {
    role: 'administrator',
    primarySurfaces: ['/governance', '/attestations'],
    visibleGroups: ['governance', 'attestations', 'evidence'],
    cognitiveLoad: 'few-surfaces',
    refusedContent: ['audit-bypassing actions'],
  },
  steward: {
    role: 'steward',
    primarySurfaces: ['/governance/review', '/evidence'],
    visibleGroups: ['governance', 'evidence'],
    cognitiveLoad: 'few-surfaces',
    refusedContent: ['mutation of recorded decisions'],
  },
  reviewer: {
    role: 'reviewer',
    primarySurfaces: ['/governance/review', '/evidence', '/attestations'],
    visibleGroups: ['governance', 'evidence', 'attestations'],
    cognitiveLoad: 'few-surfaces',
    refusedContent: ['real-time pressure cues'],
  },
  'procurement-observer': {
    role: 'procurement-observer',
    primarySurfaces: ['/governance', '/attestations'],
    visibleGroups: ['governance', 'attestations'],
    cognitiveLoad: 'one-screen',
    refusedContent: ['operational internals'],
  },
}

export function getRoleExperience(role: CanonicalRole): RoleExperience {
  return ROLE_EXPERIENCES[role]
}
