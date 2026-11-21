import { auth } from '@nzila/platform-auth/entra/server'
import { isPlatformAdmin, requirePlatformAdmin, type PlatformRole } from './partner-auth'
import { readActorPartnerBindings, readActivePartnerById, partnerEntityBinding, type PartnerBinding } from '../queries/partner-action-facts'

type PersonalContext = Readonly<{ scope: 'personal'; actorId: string; orgId: null }>
export type PlatformContext = Readonly<{ scope: 'platform'; actorId: string; orgId: null; platformRole: PlatformRole }>
export type PartnerContext = Readonly<{ scope: 'partner'; actorId: string; orgId: null; partner: PartnerBinding }>
export type EntityContext = Readonly<{ scope: 'entity'; actorId: string; orgId: string; partner: PartnerBinding; platformContext?: PlatformContext }>
export type PartnerActionContext = PersonalContext | PlatformContext | PartnerContext | EntityContext
const resolved = new WeakSet<object>()
function seal<T extends PartnerActionContext>(context: T): T {
  if ('partner' in context) Object.freeze(context.partner)
  Object.freeze(context)
  resolved.add(context)
  return context
}

export function assertPartnerActionContext(context: PartnerActionContext): void {
  if (!context || !resolved.has(context)) throw new Error('A resolved partner action context is required')
}

type PartnerRequest = { scope: 'partner'; partnerId?: string; allowPlatform?: boolean }
type EntityRequest = { scope: 'entity'; partnerId?: string; orgId?: string }
export function resolveOrgContext(request: { scope: 'platform' }): Promise<PlatformContext>
export function resolveOrgContext(request: { scope: 'personal' }): Promise<PersonalContext>
export function resolveOrgContext(request: PartnerRequest & { allowPlatform: true }): Promise<PartnerContext | PlatformContext>
export function resolveOrgContext(request: PartnerRequest & { allowPlatform?: false }): Promise<PartnerContext>
export function resolveOrgContext(request: EntityRequest): Promise<EntityContext>
/** The purpose determines the authority and data shape; personal/platform
 * contexts deliberately do not fabricate a tenant organization. */
export async function resolveOrgContext(request: { scope: 'platform' } | { scope: 'personal' } | PartnerRequest | EntityRequest): Promise<PartnerActionContext> {
  if (request.scope === 'platform') {
    const actor = await requirePlatformAdmin()
    return seal({ scope: 'platform', actorId: actor.userId, orgId: null, platformRole: actor.role })
  }
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  if (request.scope === 'personal') return seal({ scope: 'personal', actorId: userId, orgId: null })
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (request.partnerId !== undefined && (typeof request.partnerId !== 'string' || !uuid.test(request.partnerId)))
    throw new Error('Invalid partner selection')
  if (request.scope === 'entity' && request.orgId !== undefined && (typeof request.orgId !== 'string' || !uuid.test(request.orgId)))
    throw new Error('Invalid organization selection')
  let platform: PlatformContext | undefined
  if (request.scope === 'entity' || request.allowPlatform === true) {
    if (await isPlatformAdmin()) {
      const actor = await requirePlatformAdmin()
      if (actor.userId !== userId) throw new Error('Identity changed during scope resolution')
      platform = seal({ scope: 'platform', actorId: userId, orgId: null, platformRole: actor.role })
      if (request.scope === 'partner') return platform
    }
  }
  const partners = platform && request.partnerId ? await readActivePartnerById(request.partnerId)
    : await readActorPartnerBindings(userId, request.partnerId)
  if (partners.length !== 1) throw new Error('Active partner membership and an unambiguous partner selection required')
  const partner = partners[0]
  if (request.scope === 'partner') return seal({ scope: 'partner', actorId: userId, orgId: null, partner })
  const orgId = await partnerEntityBinding(partner.id, request.orgId)
  return seal({ scope: 'entity', actorId: userId, orgId, partner, ...(platform ? { platformContext: platform } : {}) })
}
