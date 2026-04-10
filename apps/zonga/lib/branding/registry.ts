/**
 * Zonga — Brand Registry
 *
 * Central registry of brand assets (Zonga, clients, partners).
 * All external brand assets MUST be registered here before rendering.
 *
 * @module @zonga/branding/registry
 */

import type {
  BrandAsset,
  BrandRegistryEntry,
  BrandPlacement,
  BrandVisibilityMode,
} from './types'

// ── Platform Brand (Immutable) ──────────────────────────────────────────────

export const ZONGA_BRAND: BrandAsset = {
  id: 'zonga',
  role: 'platform',
  name: 'Zonga',
  shortName: 'Z',
  logoUrl: '/branding/zonga-logo.svg',
  wordmarkUrl: '/branding/zonga-wordmark.svg',
  tagline: 'Music Without Borders',
}

// ── Registry ────────────────────────────────────────────────────────────────

const brandRegistry = new Map<string, BrandRegistryEntry>()

// Platform is always registered
brandRegistry.set(ZONGA_BRAND.id, { asset: ZONGA_BRAND })

/**
 * Register a brand asset (client or partner).
 * Platform re-registration is silently ignored.
 */
export function registerBrand(entry: BrandRegistryEntry): void {
  if (entry.asset.id === 'zonga') return // Platform is immutable
  brandRegistry.set(entry.asset.id, entry)
}

/**
 * Get a registered brand by ID.
 */
export function getBrand(id: string): BrandRegistryEntry | undefined {
  return brandRegistry.get(id)
}

/**
 * Get the platform brand asset.
 */
export function getPlatformBrand(): BrandAsset {
  return ZONGA_BRAND
}

/**
 * Get all registered brands by role.
 */
export function getBrandsByRole(role: BrandAsset['role']): BrandRegistryEntry[] {
  return Array.from(brandRegistry.values()).filter((e) => e.asset.role === role)
}

/**
 * Get the mode override for a brand in a specific placement, if any.
 */
export function getPlacementOverride(
  brandId: string,
  placement: BrandPlacement,
): BrandVisibilityMode | undefined {
  const entry = brandRegistry.get(brandId)
  return entry?.placementOverrides?.[placement]
}

/**
 * Check whether a brand ID is registered.
 */
export function isBrandRegistered(id: string): boolean {
  return brandRegistry.has(id)
}

/**
 * Remove a brand from the registry. Platform cannot be removed.
 */
export function unregisterBrand(id: string): boolean {
  if (id === 'zonga') return false
  return brandRegistry.delete(id)
}

/**
 * Clear all non-platform brands. Used for testing and workspace switches.
 */
export function clearExternalBrands(): void {
  for (const key of brandRegistry.keys()) {
    if (key !== 'zonga') brandRegistry.delete(key)
  }
}
