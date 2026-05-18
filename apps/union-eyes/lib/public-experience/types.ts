/**
 * Public experience type primitives.
 *
 * These types govern how Union Eyes surfaces can be classified for
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
