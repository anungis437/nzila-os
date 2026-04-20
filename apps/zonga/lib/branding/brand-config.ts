/**
 * Zonga — Deployment Brand Configuration
 *
 * Defines the real client and partner brand assets for the current deployment.
 * All external brand assets are registered here and become available
 * to the policy engine via the brand registry.
 *
 * To onboard a new partner-led deployment:
 *   1. Add brand entries below (or load from env/config)
 *   2. Call `initializeBrands()` at app startup
 *   3. Policy matrix governs where they appear — no component changes needed
 *
 * @module @zonga/branding/brand-config
 */

import type { BrandAsset, BrandRegistryEntry } from './types'
import { registerBrand } from './registry'
import { getZongaPilotMode } from '@/lib/pilot-mode'

// ── Client Brand ────────────────────────────────────────────────────────────

const CLIENT_BRANDS: Record<string, BrandAsset> = {
  none: {
    id: 'ms-celebration',
    role: 'client',
    name: 'MS Célébration Canada',
    shortName: 'MSC',
    logoUrl: '/ms-celebrations-logo.jpg',
    tagline: 'La musique qui rassemble',
  },
  ms_celebrations: {
    id: 'ms-celebration',
    role: 'client',
    name: 'MS Célébration Canada',
    shortName: 'MSC',
    logoUrl: '/ms-celebrations-logo.jpg',
    tagline: 'La musique qui rassemble',
  },
}

// ── Partner Brand ───────────────────────────────────────────────────────────

const PARTNER_BRANDS: Record<string, BrandAsset> = {
  none: {
    id: 'rock-power',
    role: 'partner',
    name: 'The Rock Power Group Inc.',
    shortName: 'RPG',
    logoUrl: '/rock-power-group-logo.png',
    relationshipLabel: 'National Distribution Partner',
  },
  ms_celebrations: {
    id: 'rock-power',
    role: 'partner',
    name: 'The Rock Power Group Inc.',
    shortName: 'RPG',
    logoUrl: '/rock-power-group-logo.png',
    relationshipLabel: 'National Distribution Partner',
  },
}

const pilotMode = getZongaPilotMode()
export const CLIENT_BRAND: BrandAsset = CLIENT_BRANDS[pilotMode]
export const PARTNER_BRAND: BrandAsset = PARTNER_BRANDS[pilotMode]

// ── Registry Entries ────────────────────────────────────────────────────────

const CLIENT_ENTRY: BrandRegistryEntry = {
  asset: CLIENT_BRAND,
  placementOverrides: {
    // Client workspace name is visible in sidebar; never in product header/marketing
    app_header: 'hidden',
    marketing_hero: 'hidden',
  },
}

const PARTNER_ENTRY: BrandRegistryEntry = {
  asset: PARTNER_BRAND,
  placementOverrides: {
    // Partner is visible in attribution / marketing — never in product chrome
    app_header: 'hidden',
    app_sidebar: 'hidden',
    app_dashboard: 'hidden',
    login: 'hidden',
    onboarding: 'hidden',
    marketing_hero: 'hidden',
  },
}

// ── Initialization ──────────────────────────────────────────────────────────

let initialized = false

/**
 * Register the deployment's client and partner brands.
 * Safe to call multiple times — only registers once.
 */
export function initializeBrands(): void {
  if (initialized) return
  registerBrand(CLIENT_ENTRY)
  registerBrand(PARTNER_ENTRY)
  initialized = true
}

/**
 * Get the client brand for the current deployment.
 */
export function getClientBrand(): BrandAsset {
  return CLIENT_BRAND
}

/**
 * Get the partner brand for the current deployment.
 */
export function getPartnerBrand(): BrandAsset {
  return PARTNER_BRAND
}
