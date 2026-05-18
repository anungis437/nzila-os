/**
 * Public experience registry.
 *
 * Defines the shape of an experience surface entry and provides
 * helpers for registering and resolving surfaces. The registry
 * is the source of truth for what surfaces exist, who can access them,
 * and what governance controls apply.
 */

import type {
  ExperienceType,
  ExperienceVisibility,
  GovernanceLevel,
  PublicContentStatus,
} from './types';

export type { ExperienceVisibility };

/** A registered experience surface (page, microsite section, campaign). */
export interface ExperienceSurface {
  /** Unique slug identifying this surface. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Route path or external URL root for this surface. */
  path: string;
  type: ExperienceType;
  visibility: ExperienceVisibility;
  governance: GovernanceLevel;
  status: PublicContentStatus;
  /** Org IDs that own or are associated with this surface. Empty = platform-wide. */
  ownerOrgIds?: string[];
  /** ISO 8601 timestamp of last governance review. */
  lastReviewedAt?: string;
  /** ISO 8601 timestamp when this surface was published. */
  publishedAt?: string;
}

/** In-memory surface registry (seeded at startup or from DB in production). */
// ga-check:exempt — seeded at startup, backed by DB in production, not primary persistence
const _registry = new Map<string, ExperienceSurface>();

/** Register an experience surface. Idempotent — last write wins. */
export function registerSurface(surface: ExperienceSurface): void {
  _registry.set(surface.id, surface);
}

/** Resolve a surface by its id. Returns undefined if not registered. */
export function resolveSurface(id: string): ExperienceSurface | undefined {
  return _registry.get(id);
}

/** Return all registered surfaces matching the given type. */
export function getSurfacesByType(type: ExperienceType): ExperienceSurface[] {
  return Array.from(_registry.values()).filter((s) => s.type === type);
}

/** Return all surfaces with a given visibility level. */
export function getSurfacesByVisibility(
  visibility: ExperienceVisibility,
): ExperienceSurface[] {
  return Array.from(_registry.values()).filter(
    (s) => s.visibility === visibility,
  );
}

/** Return all published public surfaces (convenience helper for SSG/ISR builds). */
export function getPublishedPublicSurfaces(): ExperienceSurface[] {
  return Array.from(_registry.values()).filter(
    (s) => s.visibility === 'public' && s.status === 'published',
  );
}
