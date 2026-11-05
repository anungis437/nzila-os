'use client';

/**
 * Organization Context Provider
 * 
 * Provides organization context to the application, allowing components to:
 * - Access the current organization ID
 * - Get the list of organizations the user has access to
 * - Switch between organizations
 * - Load organization hierarchy for visualization
 * 
 * Uses cookie-based persistence for selected organization across sessions.
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@nzila/platform-auth/entra/client';
import { CANONICAL_ORGANIZATION_AUTHORITY } from '@/lib/auth/organization-authority';
import { apiErrorMessage, isRecord } from '@/lib/client/api-envelope';
import { isOrganizationType, type OrganizationType } from '@/types/organization';

// Organization type definitions
export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: OrganizationType;
  parentId: string | null;
  sector?: string;
  jurisdiction?: string;
  description?: string | null;
  /** Null where the database has no date: never the time the organization was read. */
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  isPrimary: boolean;
  joinedAt: string | null;
}

export interface OrganizationContextValue {
  // Current organization
  organizationId: string | null;
  organization: Organization | null;
  isLoading: boolean;
  error: string | null;

  // User's organizations
  userOrganizations: Organization[];
  userMemberships: OrganizationMember[];
  
  // Organization hierarchy
  organizationTree: Organization[];
  organizationPath: Organization[];

  // Actions
  switchOrganization: (organizationId: string) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  loadOrganizationTree: () => Promise<void>;
}

/** What /api/users/me/organizations answers: the person's organizations and memberships, and under the canonical authority which organization is active. */
interface OrganizationsAnswer {
  organizations?: unknown;
  memberships?: OrganizationMember[];
  organizationAuthority?: string;
  activeOrganizationId?: string | null;
}

/** What the hierarchy routes answer (the path of an organization, the whole tree): organizations in `data`, and under the canonical authority the authority that made them. */
interface HierarchyAnswer {
  data?: unknown;
  organizationAuthority?: string;
}

/** What /api/organizations/switch answers. */
interface SwitchAnswer {
  success?: boolean;
  organization?: unknown;
  organizationAuthority?: string;
  activeOrganizationId?: string | null;
}

const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/**
 * An organization as the organization routes send it (lib/organizations/organization-wire.ts). What does not name an id, a name, a slug and one of the organization types is not an
 * organization: nothing is filled in for it, and a date the database does not have stays null.
 */
function normalizeOrganization(raw: unknown): Organization | null {
  if (!isRecord(raw)) return null;
  const { id, name, slug, type } = raw;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof slug !== 'string' || !isOrganizationType(type)) return null;
  return {
    id,
    name,
    slug,
    type,
    parentId: textOrNull(raw.parentId),
    sector: textOrNull(raw.sector) ?? undefined,
    jurisdiction: textOrNull(raw.jurisdiction) ?? undefined,
    description: textOrNull(raw.description),
    createdAt: textOrNull(raw.createdAt),
    updatedAt: textOrNull(raw.updatedAt),
  };
}

/** The organization record of /api/organizations/{id}, which names its columns in snake_case. */
function organizationFromRecord(raw: unknown): Organization | null {
  if (!isRecord(raw)) return null;
  return normalizeOrganization({
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    type: raw.organization_type,
    parentId: raw.parent_id,
    sector: Array.isArray(raw.sectors) ? raw.sectors[0] : undefined,
    jurisdiction: raw.province_territory,
    description: raw.description,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  });
}

/** The organizations a list holds; an entry that is not an organization is left out. */
const organizationsIn = (list: unknown): Organization[] =>
  (Array.isArray(list) ? list : []).map(normalizeOrganization).filter((org): org is Organization => org !== null);

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([]);
  const [userMemberships, setUserMemberships] = useState<OrganizationMember[]>([]);
  const [organizationTree, setOrganizationTree] = useState<Organization[]>([]);
  const [organizationPath, setOrganizationPath] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCanonicalAuthority, setIsCanonicalAuthority] = useState(false);

  /**
   * Load organization hierarchy path (ancestors)
   */
  const loadOrganizationPath = useCallback(async (orgId: string, canonical = false) => {
    try {
      const response = await fetch(`/api/organizations/${orgId}/path`, {
        credentials: 'include',
      });
      if (canonical && !response.ok) {
        throw new Error(`Failed to load canonical organization path: ${response.status}`);
      }
      if (response.ok) {
        const result = (await response.json()) as HierarchyAnswer;
        if (canonical && (result.organizationAuthority !== CANONICAL_ORGANIZATION_AUTHORITY ||
          !Array.isArray(result.data))) {
          throw new Error('Organization hierarchy response lacks canonical authority');
        }
        setOrganizationPath(organizationsIn(result.data));
      }
    } catch (err) {
      if (canonical) throw err;
      void err;
    }
  }, []);

  /**
   * Load user's organizations from API
   * This is extracted as a separate function for manual refresh
   */
  const loadUserOrganizations = useCallback(async (abortSignal?: AbortSignal) => {
    // Wait for auth to be loaded before attempting to fetch
    if (!authLoaded) {
      return;
    }

    if (!isSignedIn) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get user's organization memberships with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('/api/users/me/organizations', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortSignal || controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        void errorText;
        
        // If 401, it means user session expired or not authenticated
        if (response.status === 401) {
          setIsLoading(false);
          setError('Please sign in to continue');
          return;
        }
        
        throw new Error(`Failed to load organizations: ${response.status}`);
      }

      const data = (await response.json()) as OrganizationsAnswer;
      if (!Array.isArray(data.organizations) || !Array.isArray(data.memberships)) {
        throw new Error('Unexpected organizations response');
      }
      let organizations = organizationsIn(data.organizations);
      const memberships = data.memberships;
      const canonical = data.organizationAuthority === CANONICAL_ORGANIZATION_AUTHORITY;
      setIsCanonicalAuthority(canonical);

      if (canonical) {
        const activeOrganizationId = data.activeOrganizationId;
        if (activeOrganizationId !== null && typeof activeOrganizationId !== 'string') {
          throw new Error('Canonical organization response has no authoritative selection');
        }
        const active = organizations.find((org) => org.id === activeOrganizationId);
        if (activeOrganizationId !== null && !active) {
          throw new Error('Canonical organization selection is not in the authorized list');
        }
        setUserOrganizations(organizations);
        setUserMemberships(memberships);
        setOrganizationId(activeOrganizationId);
        setOrganization(active ?? null);
        setOrganizationPath([]);
        setOrganizationTree([]);
        if (active) await loadOrganizationPath(active.id, true);
        return;
      }

      // Fallback: if memberships exist but org objects are empty, resolve
      // organizations directly by membership IDs.
      if (organizations.length === 0 && memberships.length > 0) {
        const resolvedOrgs: Organization[] = [];
        for (const membership of memberships) {
          try {
            const orgResponse = await fetch(`/api/organizations/${membership.organizationId}`, {
              credentials: 'include',
              signal: abortSignal || controller.signal,
            });
            if (orgResponse.ok) {
              const orgResult = (await orgResponse.json()) as { data?: unknown };
              const org = organizationFromRecord(orgResult.data);
              if (org && !resolvedOrgs.some((existing) => existing.id === org.id)) {
                resolvedOrgs.push(org);
              }
            }
          } catch {
            // Keep trying remaining memberships.
          }
        }
        organizations = resolvedOrgs;
      }

      // Canonical fallback: the server-backed profile summary already knows the
      // active organization even when the org-membership list is temporarily out
      // of sync on the client.
      if (organizations.length === 0) {
        try {
          const profileResponse = await fetch('/api/users/me/profile', {
            credentials: 'include',
            signal: abortSignal || controller.signal,
          });

          if (profileResponse.ok) {
            const profileResult = (await profileResponse.json()) as { organization?: unknown };
            const profileOrg = normalizeOrganization(profileResult.organization);
            if (profileOrg) {
              organizations = [profileOrg];
            }
          }
        } catch {
          // An organization that cannot be resolved is reported below, never invented from a membership.
        }
      }

      setUserOrganizations(organizations);
      setUserMemberships(memberships);

      // If user has organizations, select the primary one or first available
      if (organizations.length > 0) {
        // Check if there's a selected organization in cookie (stored as UUID)
        const cookies = document.cookie.split(';');
        const selectedOrgCookie = cookies.find(c => c.trim().startsWith('selected_organization_id='));
        let selectedOrgId = selectedOrgCookie?.split('=')[1];

        // Validate that user has access to the selected organization (by UUID)
        const hasAccess = organizations.some((org) => org.id === selectedOrgId);
        
        if (!selectedOrgId || !hasAccess) {
          // Find primary organization
          const primaryMembership = memberships.find((m) => m.isPrimary);
          
          if (primaryMembership) {
            // Membership organizationId is the UUID, matches organizations.id directly
            const primaryOrg = organizations.find((o) => 
              o.id === primaryMembership.organizationId
            );
            selectedOrgId = primaryOrg?.id || organizations[0]?.id || undefined;
          } else {
            // Default to first organization
            selectedOrgId = organizations[0]?.id || undefined;
          }
        }

        setOrganizationId(selectedOrgId || null);

        // Persist to cookie so server-side getCurrentUser() can resolve the org
        // (the auth provider doesn't supply orgId here, and this is the initial
        // auto-selection — switchOrganization sets the cookie on explicit switch)
        if (selectedOrgId) {
          document.cookie = `selected_org_id=${selectedOrgId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
          document.cookie = `selected_organization_id=${selectedOrgId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
        }

        // Load organization details (by UUID)
        const org = organizations.find((o) => o.id === selectedOrgId);
        if (org) {
          setOrganization(org);
          // Load organization path inline to avoid dependency issues
          const pathResponse = await fetch(`/api/organizations/${org.id}/path`, {
            credentials: 'include',
            signal: abortSignal || controller.signal,
          });
          if (pathResponse.ok) {
            const pathResult = (await pathResponse.json()) as HierarchyAnswer;
            setOrganizationPath(organizationsIn(pathResult.data));
          }
        } else if (selectedOrgId) {
          await loadOrganizationPath(selectedOrgId);
        }
      } else if (memberships.length > 0) {
        // The person has memberships but none of their organizations could be read (the organization records may not exist).
        // The screen says so; no organization is made up from a membership.
        setError('Organization data not found. Please contact support.');
      }
    } catch (err) {
      // Don't show error if request was aborted (cleanup)
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      setError(err instanceof Error ? err.message : 'Failed to load organizations');
    } finally {
      setIsLoading(false);
    }
  }, [authLoaded, isSignedIn, loadOrganizationPath]);

  /**
   * Load full organization tree for visualization
   */
  const loadOrganizationTree = useCallback(async () => {
    try {
      const response = await fetch('/api/organizations/tree', {
        credentials: 'include',
      });
      if (isCanonicalAuthority && !response.ok) {
        throw new Error(`Failed to load canonical organization tree: ${response.status}`);
      }
      if (response.ok) {
        const result = (await response.json()) as HierarchyAnswer;
        if (isCanonicalAuthority && (result.organizationAuthority !== CANONICAL_ORGANIZATION_AUTHORITY ||
          !Array.isArray(result.data))) {
          throw new Error('Organization tree response lacks canonical authority');
        }
        setOrganizationTree(organizationsIn(result.data));
      }
    } catch (err) {
      if (isCanonicalAuthority) {
        setError(err instanceof Error ? err.message : 'Failed to load canonical organization tree');
        return;
      }
      void err;
    }
  }, [isCanonicalAuthority]);

  /**
   * Switch to a different organization
   * Now with server-side validation for security
   */
  const switchOrganization = useCallback(async (newOrganizationId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Call server-side validation endpoint
      const response = await fetch('/api/organizations/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `org-switch-${newOrganizationId}-${Date.now()}`,
        },
        credentials: 'include',
        body: JSON.stringify({ organizationId: newOrganizationId }),
      });

      if (!response.ok) {
        const errorData: unknown = await response.json().catch(() => null);
        throw new Error(apiErrorMessage(errorData, errorData === null ? 'Failed to switch organization' : 'Access denied'));
      }

      const data = (await response.json()) as SwitchAnswer;
      
      if (!data.success) {
        throw new Error('Organization switch validation failed');
      }

      const switched = normalizeOrganization(data.organization);

      if (data.organizationAuthority === CANONICAL_ORGANIZATION_AUTHORITY) {
        const activeOrganizationId = data.activeOrganizationId;
        if (typeof activeOrganizationId !== 'string' || activeOrganizationId !== newOrganizationId || switched?.id !== newOrganizationId) {
          throw new Error('Canonical organization switch returned a different selection');
        }
        setOrganizationId(activeOrganizationId);
        setOrganization(switched);
        setOrganizationPath([]);
        setOrganizationTree([]);
        await loadOrganizationPath(activeOrganizationId, true);
        window.location.reload();
        return;
      }

      const secureAttr = window.location.protocol === 'https:' ? '; Secure' : '';

      // Server validated the switch, now update cookies
      document.cookie = `selected_org_id=${newOrganizationId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict${secureAttr}`; // 1 year — primary
      document.cookie = `selected_organization_id=${newOrganizationId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict${secureAttr}`; // 1 year
      // Legacy cookie — deprecated, read-only fallback in middleware
      document.cookie = `selected_tenant_id=${newOrganizationId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict${secureAttr}`;
      // Server-side org resolution reads slug cookie
      if (switched?.slug) {
        document.cookie = `active-organization=${switched.slug}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Strict${secureAttr}`; // 30 days
      }

      // Update state
      setOrganizationId(newOrganizationId);
      
      if (switched) {
        setOrganization(switched);
        await loadOrganizationPath(newOrganizationId);
      }

      // Reload the page to refresh all data with new organization context
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch organization');
      setIsLoading(false);
    }
  }, [loadOrganizationPath]);

  /**
   * Refresh organizations list
   */
  const refreshOrganizations = useCallback(async () => {
    await loadUserOrganizations();
  }, [loadUserOrganizations]);

  // Load organizations when user is authenticated
  useEffect(() => {
    const controller = new AbortController();

    if (authLoaded && isSignedIn) {
      loadUserOrganizations(controller.signal);
    } else if (authLoaded && !isSignedIn) {
      setIsLoading(false);
    }

    return () => {
      controller.abort();
    };
  }, [authLoaded, isSignedIn, loadUserOrganizations]);

  // NOTE: Cookies are written only in switchOrganization() (explicit user action).
  // Previously this useEffect wrote cookies on every org change including initial
  // load, which caused stale cookies to self-reinforce (e.g. CAPE org persisting
  // on staging even though Nzila was the primary org in the database).

  const value: OrganizationContextValue = {
    organizationId,
    organization,
    isLoading,
    error,
    userOrganizations,
    userMemberships,
    organizationTree,
    organizationPath,
    switchOrganization,
    refreshOrganizations,
    loadOrganizationTree,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

/**
 * Hook to access organization context
 */
export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

/**
 * Hook to get current organization ID
 */
export function useOrganizationId(): string | null {
  const { organizationId } = useOrganization();
  return organizationId;
}

/**
 * Hook to get user's organizations
 */
export function useUserOrganizations(): Organization[] {
  const { userOrganizations } = useOrganization();
  return userOrganizations;
}

/**
 * Hook to switch organizations
 */
export function useSwitchOrganization(): (organizationId: string) => Promise<void> {
  const { switchOrganization } = useOrganization();
  return switchOrganization;
}
