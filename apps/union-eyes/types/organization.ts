// =====================================================
// Types for Hierarchical Organization Model
// Generated for Phase 5A: CLC Multi-Org Support
// =====================================================

import type { CAJurisdiction } from '@/lib/jurisdiction-helpers-client';

/**
 * Organization types in the CLC hierarchy
 */
export type OrganizationType = 
  | 'platform'     // SaaS platform provider (Nzila Ventures)
  | 'congress'      // CLC national level
  | 'federation'    // Provincial/territorial federations (OFL, BCFED)
  | 'union'         // National/international unions (CUPE, Unifor, UFCW)
  | 'local'         // Local unions/chapters
  | 'region'        // Regional councils
  | 'district';     // District labour councils

// Re-export for convenience
export type { CAJurisdiction };

/**
 * Labour sectors
 */
export type LabourSector =
  | 'healthcare'
  | 'education'
  | 'public_service'
  | 'trades'
  | 'manufacturing'
  | 'transportation'
  | 'retail'
  | 'hospitality'
  | 'technology'
  | 'construction'
  | 'utilities'
  | 'telecommunications'
  | 'financial_services'
  | 'agriculture'
  | 'arts_culture'
  | 'other';

/**
 * Organization relationship types
 */
export type OrganizationRelationshipType =
  | 'affiliate'      // CLC → National Union
  | 'federation'     // CLC → Provincial Federation
  | 'local'          // National Union → Local
  | 'chapter'        // National Union → Chapter
  | 'region'         // National Union → Regional Council
  | 'district'       // Federation → District Council
  | 'joint_council'  // Multiple unions → Joint council
  | 'merged_from'    // Historical merger
  | 'split_from';    // Historical split

/**
 * Organization status
 */
export type OrganizationStatus = 'active' | 'inactive' | 'suspended' | 'archived';

/**
 * Address structure
 */
export interface OrganizationAddress {
  street?: string;
  unit?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
}

/**
 * Organization settings
 */
export interface OrganizationSettings {
  bilingual?: boolean;
  primary_language?: 'en' | 'fr';
  secondary_language?: 'en' | 'fr';
  headquarters?: string;
  industry?: string;
  major_employers?: string[];
  founded?: number;
  locals_count?: number;
  largest_union_in_canada?: boolean;
  largest_local_in_canada?: boolean;
  formed_by_merger?: string[];
  international_affiliate?: string;
  sectors?: string[];
  [key: string]: unknown; // Allow additional custom settings
}

/**
 * Main Organization model
 */
export interface Organization {
  id: string;
  
  // Basic Information
  name: string;
  slug: string;
  display_name?: string;
  short_name?: string;
  
  // Hierarchy
  organization_type: OrganizationType;
  parent_id?: string;
  hierarchy_path: string[];
  hierarchy_level: number;
  
  // Jurisdiction & Sectors
  jurisdiction?: CAJurisdiction;
  province_territory?: string;
  sectors: LabourSector[];
  
  // Contact & Metadata
  email?: string;
  phone?: string;
  website?: string;
  address?: OrganizationAddress;
  
  // CLC Affiliation
  clc_affiliated: boolean;
  affiliation_date?: string;
  charter_number?: string;
  
  // Membership Counts (cached)
  member_count: number;
  active_member_count: number;
  last_member_count_update?: string;
  
  // Billing & Settings
  subscription_tier?: string;
  billing_contact_id?: string;
  settings: OrganizationSettings;
  features_enabled: string[];
  
  // Status & Audit
  status: OrganizationStatus;
  created_at: string;
  updated_at: string;
  created_by?: string;
  
  // Legacy Migration Support
  legacy_org_id?: string;
}

/**
 * Organization with parent/children references (for tree views)
 */
export interface OrganizationWithRelations extends Organization {
  parent?: Organization;
  children?: Organization[];
  ancestors?: Organization[];
  descendants?: Organization[];
}

/**
 * Organization relationship
 */
export interface OrganizationRelationship {
  id: string;
  parent_org_id: string;
  child_org_id: string;
  relationship_type: OrganizationRelationshipType;
  effective_date: string;
  end_date?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  created_by?: string;
}

/**
 * Organization tree node (for UI rendering)
 */
export interface OrganizationTreeNode {
  id: string;
  name: string;
  slug: string;
  organization_type: OrganizationType;
  hierarchy_level: number;
  hierarchy_path: string[];
  display_path: string[];
  full_path: string;
  member_count: number;
  children?: OrganizationTreeNode[];
  parent_id?: string;
}

/**
 * Create organization request
 */
export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  organization_type: OrganizationType;
  parent_id?: string;
  jurisdiction?: CAJurisdiction;
  sectors?: LabourSector[];
  email?: string;
  phone?: string;
  website?: string;
  clc_affiliated?: boolean;
  affiliation_date?: string;
  charter_number?: string;
  settings?: OrganizationSettings;
}

/**
 * Update organization request
 */
export interface UpdateOrganizationRequest {
  name?: string;
  display_name?: string;
  short_name?: string;
  parent_id?: string;
  jurisdiction?: CAJurisdiction;
  sectors?: LabourSector[];
  email?: string;
  phone?: string;
  website?: string;
  address?: OrganizationAddress;
  settings?: OrganizationSettings;
  status?: OrganizationStatus;
}

/**
 * Organization member
 */
export interface OrganizationMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: 'admin' | 'manager' | 'steward' | 'member';
  status: 'active' | 'inactive' | 'suspended';
  membership_number?: string;
  joined_at: string;
  updated_at: string;
  
  // Relations
  organization?: Organization;
}

/**
 * Organization visibility scope for RLS
 */
export interface OrganizationVisibilityScope {
  user_id: string;
  visible_org_ids: string[];
  own_org_id: string;
  parent_org_ids: string[];
  child_org_ids: string[];
  descendant_org_ids: string[];
}

/**
 * Organization statistics (for admin dashboards)
 */
export interface OrganizationStats {
  organization_id: string;
  organization_name: string;
  organization_type: OrganizationType;
  
  // Membership
  total_members: number;
  active_members: number;
  new_members_this_month: number;
  
  // Claims/Grievances
  total_claims: number;
  active_claims: number;
  resolved_claims: number;
  avg_resolution_days: number;
  
  // Financial
  total_dues_collected: number;
  strike_fund_balance: number;
  
  // Hierarchy
  direct_children_count: number;
  total_descendants_count: number;
  
  // Activity
  last_activity_at?: string;
}

/**
 * Sector comparison data (for analytics)
 */
export interface SectorComparison {
  sector: LabourSector;
  organizations_count: number;
  total_members: number;
  avg_wage?: number;
  avg_claim_resolution_days?: number;
  top_claim_types?: Array<{ type: string; count: number }>;
}

/**
 * Jurisdiction metadata
 */
export interface JurisdictionMetadata {
  code: CAJurisdiction;
  name: string;
  name_fr?: string;
  type: 'federal' | 'provincial' | 'territorial';
  labour_board: string;
  arbitration_deadline_days?: number;
  certification_threshold?: string;
  strike_vote_requirement?: string;
}

/**
 * Helper type: Backwards compatibility alias
 * @deprecated Use Organization directly
 */
export type Org = Organization;

/**
 * Helper type: Backwards compatibility alias
 * @deprecated Use OrganizationId instead
 */
export type OrganizationId = string;

// =====================================================
// Utility Functions
// =====================================================

/**
 * Check if organization is a CLC affiliate
 */
export function isCLCAffiliate(org: Organization): boolean {
  return org.clc_affiliated === true && !!org.affiliation_date;
}

/**
 * Get organization display name (with fallback)
 */
export function getOrganizationDisplayName(org: Organization): string {
  return org.display_name || org.name;
}

/**
 * Check if user can access organization (based on hierarchy)
 */
export function canAccessOrganization(
  userOrgId: string,
  targetOrgId: string,
  visibilityScope: OrganizationVisibilityScope
): boolean {
  return visibilityScope.visible_org_ids.includes(targetOrgId);
}

/**
 * Format hierarchy path for display
 */
export function formatHierarchyPath(path: string[]): string {
  return path.join(' → ');
}

/**
 * Get organization type label
 */
export function getOrganizationTypeLabel(type: OrganizationType): string {
  const labels: Record<OrganizationType, string> = {
    platform: 'Platform',
    congress: 'Congress',
    federation: 'Federation',
    union: 'Union',
    local: 'Local',
    region: 'Region',
    district: 'District',
  };
  return labels[type];
}

/**
 * Get sector display name
 */
export function getSectorLabel(sector: LabourSector): string {
  const labels: Record<LabourSector, string> = {
    healthcare: 'Healthcare',
    education: 'Education',
    public_service: 'Public Service',
    trades: 'Trades',
    manufacturing: 'Manufacturing',
    transportation: 'Transportation',
    retail: 'Retail',
    hospitality: 'Hospitality',
    technology: 'Technology',
    construction: 'Construction',
    utilities: 'Utilities',
    telecommunications: 'Telecommunications',
    financial_services: 'Financial Services',
    agriculture: 'Agriculture',
    arts_culture: 'Arts & Culture',
    other: 'Other',
  };
  return labels[sector];
}
