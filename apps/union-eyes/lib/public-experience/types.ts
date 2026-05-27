/**
 * Public experience type primitives.
 *
 * These types govern how UnionEyes surfaces can be classified for
 * audience, visibility, governance level, and lifecycle status.
 * They feed the public-experience registry and are enforced at the
 * route-policy layer before any content is published or promoted.
 */

/** The audience/deployment mode of a surface or piece of content. */
export type ExperienceType =
  | 'internal'      // staff/admin-only — never publicly accessible
  | 'member'        // authenticated union member access
  | 'public'        // fully public (union website, campaign page)
  | 'campaign'      // time-boxed public surface (organizing campaign, election)
  | 'federation';   // multi-org / national-regional hierarchy surface

/** Visibility contract for a surface or content item. */
export type ExperienceVisibility =
  | 'private'          // org-internal only
  | 'authenticated'    // logged-in members only
  | 'public';          // no auth required

/**
 * Governance review requirement before a surface can be published or
 * promoted to a higher-visibility state.
 */
export type GovernanceLevel =
  | 'standard'           // no review gate — staff can publish
  | 'review-required'    // requires governance review before promotion
  | 'executive-approved'; // requires executive/officer sign-off

/** Lifecycle state of a public content item. */
export type PublicContentStatus =
  | 'draft'      // created, not submitted for review
  | 'review'     // submitted for governance review
  | 'approved'   // passed governance gate; ready to publish
  | 'published'  // live on public surface
  | 'archived';  // removed from public surface; history preserved

// ── Wave 10: Federation sovereignty metadata (shadow-mode only) ───────────────

/**
 * Federated visibility scope for a public-experience surface.
 * Shadow-mode metadata — never blocks publication in production.
 */
export type FederatedVisibility =
  | 'local-only'       // visible only within the originating local unit
  | 'regional'         // visible to regional federation members
  | 'national'         // visible federation-wide
  | 'coalition'        // visible across coalition partners
  | 'unrestricted';    // no federated visibility restriction

/**
 * Whether a delegated publication authority is required for this surface
 * before it can be promoted within the federation.
 * Shadow-mode metadata — annotated but not enforced in production yet.
 */
export type DelegatedPublicationAuthority =
  | 'not-required'     // no delegation check needed
  | 'local-delegate'   // local unit must hold publication authority
  | 'regional-delegate' // regional approval required
  | 'national-delegate'; // national approval required

/**
 * Optional Wave 10 federation sovereignty metadata attachable to any
 * public-experience surface or content item.
 *
 * All fields are shadow-mode only — none alter production routing.
 */
export interface FederationSovereigntyMetadata {
  /** Federated visibility classification for this surface. */
  federatedVisibility?: FederatedVisibility;
  /** Delegation authority level required to publish within the federation. */
  delegatedPublicationAuthority?: DelegatedPublicationAuthority;
  /** Whether federation approval gate is needed before promotion. */
  federationApprovalRequired?: boolean;
  /** Shadow-mode only — never blocks production. */
  governanceMode: 'shadow';
}
