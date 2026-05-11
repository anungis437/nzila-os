/**
 * @nzila/doctrine-enforcement — AI capability registry
 *
 * Registers AI capabilities with structural refusal of categorically
 * prohibited behaviors. Unregistered capabilities cannot be invoked
 * through the validated path.
 *
 * @module @nzila/doctrine-enforcement/ai-capability-registry
 */
import { z } from 'zod'

import {
  CATEGORICALLY_REFUSED_AI_BEHAVIORS,
  type AICapabilityRegistration,
  type CategoricallyRefusedAIBehavior,
  type DoctrineCitation,
} from './types'

const doctrineCitationSchema: z.ZodType<DoctrineCitation> = z
  .object({
    document: z.string().min(1),
    section: z.string().min(1).optional(),
    policyId: z.string().min(1).optional(),
  })
  .strict()

const refusedSet: ReadonlySet<string> = new Set(CATEGORICALLY_REFUSED_AI_BEHAVIORS)

export const aiCapabilityRegistrationSchema: z.ZodType<AICapabilityRegistration> = z
  .object({
    capabilityId: z.string().min(1),
    version: z.string().min(1),
    description: z.string().min(1),
    surfaces: z.array(z.string().min(1)).min(1),
    explainabilitySurface: z.string().min(1, {
      message: 'AI capabilities must bind an explainability surface',
    }),
    reviewabilitySurface: z.string().min(1, {
      message: 'AI capabilities must bind a reviewability surface',
    }),
    humanAuthorityGates: z.array(z.string().min(1)),
    doctrineCitations: z.array(doctrineCitationSchema).min(1, {
      message:
        'AI capabilities must cite at least one doctrine document; uncited capabilities are rejected',
    }),
    governanceReviewRecordId: z.string().min(1),
    declaredBehaviors: z.array(z.string()),
    registeredBy: z.string().min(1),
    registeredAt: z.string().min(1),
  })
  .strict()
  .refine(
    (reg) => reg.declaredBehaviors.every((b) => !refusedSet.has(b)),
    {
      message:
        'AI capability declares a categorically refused behavior; registration rejected',
      path: ['declaredBehaviors'],
    },
  )

export class AICapabilityRegistry {
  private readonly entries = new Map<string, AICapabilityRegistration>()

  register(registration: AICapabilityRegistration): AICapabilityRegistration {
    const validated = aiCapabilityRegistrationSchema.parse(registration)
    const key = `${validated.capabilityId}@${validated.version}`
    if (this.entries.has(key)) {
      throw new Error(`AI capability "${key}" is already registered`)
    }
    this.entries.set(key, validated)
    return validated
  }

  get(capabilityId: string, version: string): AICapabilityRegistration | undefined {
    return this.entries.get(`${capabilityId}@${version}`)
  }

  isRegistered(capabilityId: string, version: string): boolean {
    return this.entries.has(`${capabilityId}@${version}`)
  }

  list(): readonly AICapabilityRegistration[] {
    return Array.from(this.entries.values())
  }
}

export function isCategoricallyRefused(
  behavior: string,
): behavior is CategoricallyRefusedAIBehavior {
  return refusedSet.has(behavior)
}
