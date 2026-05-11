/**
 * @nzila/doctrine-enforcement — Policy registry
 *
 * In-memory policy registry. Policies are append-only at the (id, version)
 * grain — superseded versions remain readable for evaluator reproducibility.
 *
 * Doctrine-citation discipline is enforced at registration time. Policies
 * without at least one doctrine citation are rejected.
 *
 * @module @nzila/doctrine-enforcement/registry
 */
import { z } from 'zod'

import type {
  DoctrineCitation,
  GovernancePolicy,
  PolicyDomain,
  PolicyEffect,
  PolicyScope,
  PolicySeverity,
} from './types'

const policyConditionSchema = z
  .object({
    field: z.string().min(1),
    operator: z.enum([
      'eq',
      'neq',
      'in',
      'not_in',
      'gt',
      'gte',
      'lt',
      'lte',
      'matches',
      'present',
      'absent',
    ]),
    value: z.unknown().optional(),
  })
  .strict()

const policyScopeSchema: z.ZodType<PolicyScope> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('global') }).strict(),
  z.object({ kind: z.literal('product'), product: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('environment'), environment: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('org'), orgScope: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('pilot'), pilotScope: z.string().min(1) }).strict(),
])

const doctrineCitationSchema: z.ZodType<DoctrineCitation> = z
  .object({
    document: z.string().min(1),
    section: z.string().min(1).optional(),
    policyId: z.string().min(1).optional(),
  })
  .strict()

export const governancePolicySchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    domain: z.enum([
      'role',
      'route',
      'pilot',
      'ai-exposure',
      'continuity-safe-visibility',
      'executive-safety',
      'deployment',
      'environment',
    ]) satisfies z.ZodType<PolicyDomain>,
    scope: policyScopeSchema,
    description: z.string().min(1),
    doctrineCitations: z.array(doctrineCitationSchema).min(1, {
      message:
        'policies must cite at least one doctrine document; uncited policies are rejected',
    }),
    conditions: z.array(policyConditionSchema),
    effect: z.enum(['allow', 'deny', 'require_approval', 'require_review']) satisfies z.ZodType<PolicyEffect>,
    severity: z.enum(['info', 'warning', 'critical']) satisfies z.ZodType<PolicySeverity>,
    registeredBy: z.string().min(1),
    registeredAt: z.string().min(1),
  })
  .strict() satisfies z.ZodType<GovernancePolicy>

export class DoctrinePolicyRegistry {
  private readonly entries = new Map<string, GovernancePolicy[]>()

  /**
   * Register a new policy version. Throws if validation fails or if a
   * policy with the same (id, version) is already registered.
   */
  register(policy: GovernancePolicy): GovernancePolicy {
    const validated = governancePolicySchema.parse(policy)
    const existing = this.entries.get(validated.id) ?? []
    if (existing.some((p) => p.version === validated.version)) {
      throw new Error(
        `policy "${validated.id}" version "${validated.version}" is already registered; issue a new version`,
      )
    }
    this.entries.set(validated.id, [...existing, validated])
    return validated
  }

  /** Return the most recently registered version of a policy. */
  latest(id: string): GovernancePolicy | undefined {
    const versions = this.entries.get(id)
    if (!versions || versions.length === 0) return undefined
    return versions[versions.length - 1]
  }

  /** Return a specific version. */
  get(id: string, version: string): GovernancePolicy | undefined {
    return this.entries.get(id)?.find((p) => p.version === version)
  }

  /** List all policies (all versions) in the registry. */
  list(): readonly GovernancePolicy[] {
    return Array.from(this.entries.values()).flat()
  }

  /** Filter by domain. */
  byDomain(domain: PolicyDomain): readonly GovernancePolicy[] {
    return this.list().filter((p) => p.domain === domain)
  }

  size(): number {
    return Array.from(this.entries.values()).reduce((acc, v) => acc + v.length, 0)
  }
}
