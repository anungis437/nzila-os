'use server'

import { revalidatePath } from 'next/cache'
import { resolveOrgContext } from '@/lib/resolve-org'
import {
  upsertOrgSettings,
  upsertOrgQuotePolicy,
  upsertOrgBranding,
} from '@nzila/platform-commerce-org/service'
import type {
  OrgCommerceSettings,
  OrgQuotePolicy,
  OrgBrandingConfig,
} from '@nzila/platform-commerce-org/types'
import { emitConfigChange } from '@/lib/config-events'

// ── Save general settings (currency, prefix, validity, tax) ────────────────

export async function saveGeneralSettingsAction(
  input: Omit<OrgCommerceSettings, 'orgId'>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await resolveOrgContext()
    const { changeEvent } = await upsertOrgSettings(ctx.orgId, input, ctx.actorId)
    emitConfigChange(changeEvent)
    revalidatePath('/settings')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Save quote policy (margin floors) ──────────────────────────────────────

export async function saveQuotePolicyAction(
  input: Omit<OrgQuotePolicy, 'orgId'>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await resolveOrgContext()
    const { changeEvent } = await upsertOrgQuotePolicy(ctx.orgId, input, ctx.actorId)
    emitConfigChange(changeEvent)
    revalidatePath('/settings')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Save branding (company name, address, colours) ─────────────────────────

export async function saveBrandingAction(
  input: Omit<OrgBrandingConfig, 'orgId'>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await resolveOrgContext()
    const { changeEvent } = await upsertOrgBranding(ctx.orgId, input, ctx.actorId)
    emitConfigChange(changeEvent)
    revalidatePath('/settings')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
