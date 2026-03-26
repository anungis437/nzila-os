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
import { useAuth } from '@clerk/nextjs';

// Organization type definitions
export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: 'platform' | 'congress' | 'federation' | 'union' | 'local' | 'district' | 'chapter';
  parentId: string | null;
  sector?: string;
  jurisdiction?: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  isPrimary: boolean;
  joinedAt: string;
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

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const { userId, isLoaded: authLoaded } = useAuth();
  
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([]);
  const [userMemberships, setUserMemberships] = useState<OrganizationMember[]>([]);
  const [organizationTree, setOrganizationTree] = useState<Organization[]>([]);
  const [organizationPath, setOrganizationPath] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load user's organizations from API
   * This is extracted as a separate function for manual refresh
   */
  const loadUserOrganizations = useCallback(async (abortSignal?: AbortSignal) => {
    // Wait for auth to be loaded before attempting to fetch
    if (!authLoaded) {
      return;
    }

    if (!userId) {
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

      const data = await response.json();
      setUserOrganizations(data.organizations || []);
      setUserMemberships(data.memberships || []);

      // If user has organizations, select the primary one or first available
      if (data.organizations && data.organizations.length > 0) {
        // Check if there's a selected organization in cookie (stored as UUID)
        const cookies = document.cookie.split(';');
        const selectedOrgCookie = cookies.find(c => c.trim().startsWith('selected_organization_id='));
        let selectedOrgId = selectedOrgCookie?.split('=')[1];

        // Validate that user has access to the selected organization (by UUID)
        const hasAccess = data.organizations.some((org: Organization) => org.id === selectedOrgId);
        
        if (!selectedOrgId || !hasAccess) {
          // Find primary organization
          const primaryMembership = data.memberships?.find((m: OrganizationMember) => m.isPrimary);
          
          if (primaryMembership) {
            // Membership organizationId is the UUID, matches organizations.id directly
            const primaryOrg = data.organizations.find((o: Organization) => 
              o.id === primaryMembership.organizationId
            );
            selectedOrgId = primaryOrg?.id || data.organizations[0]?.id || null;
          } else {
            // Default to first organization
            selectedOrgId = data.organizations[0]?.id || null;
          }
        }

        setOrganizationId(selectedOrgId || null);

        // Persist to cookie so server-side getCurrentUser() can resolve the org
        // (Clerk satellite mode doesn't provide orgId, and this is the initial
        // auto-selection — switchOrganization sets the cookie on explicit switch)
        if (selectedOrgId) {
          document.cookie = `selected_org_id=${selectedOrgId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
          document.cookie = `selected_organization_id=${selectedOrgId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
        }

        // Load organization details (by UUID)
        const org = data.organizations.find((o: Organization) => o.id === selectedOrgId);
        if (org) {
          setOrganization(org);
          // Load organization path inline to avoid dependency issues
          const pathResponse = await fetch(`/api/organizations/${org.id}/path`, {
            credentials: 'include',
            signal: abortSignal || controller.signal,
          });
          if (pathResponse.ok) {
            const pathResult = await pathResponse.json();
            setOrganizationPath(pathResult.data || []);
          }
        }
      } else if (data.memberships && data.memberships.length > 0) {
        // User has memberships but no organizations found
        // This can happen if organization records don't exist in DB
        void data;
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
  }, [userId, authLoaded]);

  /**
   * Load organization hierarchy path (ancestors)
   */
  const loadOrganizationPath = useCallback(async (orgId: string) => {
    try {
      const response = await fetch(`/api/organizations/${orgId}/path`, {
        credentials: 'include',
      });
      if (response.ok) {
        const result = await response.json();
        setOrganizationPath(result.data || []);
      }
    } catch (err) {
      void err;
    }
  }, []);

  /**
   * Load full organization tree for visualization
   */
  const loadOrganizationTree = useCallback(async () => {
    try {
      const response = await fetch('/api/organizations/tree', {
        credentials: 'include',
      });
      if (response.ok) {
        const result = await response.json();
        setOrganizationTree(result.data || []);
      }
    } catch (err) {
      void err;
    }
  }, []);

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
        const errorData = await response.json().catch(() => ({ error: 'Failed to switch organization' }));
        throw new Error(errorData.error || 'Access denied');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Organization switch validation failed');
      }

      // Server validated the switch, now update cookies
      document.cookie = `selected_org_id=${newOrganizationId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict; Secure`; // 1 year — primary
      document.cookie = `selected_organization_id=${newOrganizationId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict; Secure`; // 1 year
      // Legacy cookie — deprecated, read-only fallback in middleware
      document.cookie = `selected_tenant_id=${newOrganizationId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict; Secure`;
      // Server-side org resolution reads slug cookie
      if (data.organization?.slug) {
        document.cookie = `active-organization=${data.organization.slug}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Strict; Secure`; // 30 days
      }

      // Update state
      setOrganizationId(newOrganizationId);
      
      if (data.organization) {
        setOrganization(data.organization);
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

    if (authLoaded && userId) {
      loadUserOrganizations(controller.signal);
    } else if (authLoaded && !userId) {
      setIsLoading(false);
    }

    return () => {
      controller.abort();
    };
  }, [authLoaded, userId, loadUserOrganizations]);

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

