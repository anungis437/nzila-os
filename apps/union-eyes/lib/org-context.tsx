"use client";

/**
 * Organization Context Provider
 *
 * Provides organization context throughout the application.
 * Supports organization switching for multi-org scenarios.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

import { useAuth, useOrganization } from '@nzila/platform-auth/entra/client';

/** Organization information returned from /api/org/current */
export interface OrgInfo {
  organizationId: string;
  name: string;
  slug: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings?: Record<string, any>;
  subscriptionTier?: string;
  features?: string[];
}

/** Context value shape for OrgProvider */
interface OrgContextType {
  currentOrg: OrgInfo | null;
  orgs: OrgInfo[];
  isLoading: boolean;
  error: Error | null;
  switchOrg: (organizationId: string) => Promise<void>;
  refreshOrgs: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

interface OrgProviderProps {
  children: React.ReactNode;
}

/**
 * Organization Provider Component
 *
 * Wraps the application to provide organization context.
 * Automatically loads org information based on current auth session.
 */
export function OrgProvider({ children }: OrgProviderProps) {
  const { userId, isLoaded: authLoaded } = useAuth();
  const { organization: _organization, isLoaded: orgLoaded } = useOrganization();

  const [currentOrg, setCurrentOrg] = useState<OrgInfo | null>(null);
  const [orgs, setOrgs] = useState<OrgInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /** Fetch organization information from API */
  const fetchOrgInfo = useCallback(async () => {
    if (!userId || !authLoaded) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/org/current", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch org info: ${response.statusText}`);
      }

      const data = await response.json();

      setCurrentOrg(data.org);
      setOrgs(data.availableOrgs || [data.org]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [userId, authLoaded]);

  /** Switch to a different organization */
  const switchOrg = useCallback(async (organizationId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/org/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to switch org: ${response.statusText}`);
      }

      const data = await response.json();
      setCurrentOrg(data.org);

      // Reload the page to refresh all org-specific data
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Refresh organization list */
  const refreshOrgs = useCallback(async () => {
    await fetchOrgInfo();
  }, [fetchOrgInfo]);

  // Load org info when auth is ready
  useEffect(() => {
    if (authLoaded && orgLoaded) {
      fetchOrgInfo();
    }
  }, [authLoaded, orgLoaded, fetchOrgInfo]);

  const value: OrgContextType = {
    currentOrg,
    orgs,
    isLoading,
    error,
    switchOrg,
    refreshOrgs,
  };

  return (
    <OrgContext.Provider value={value}>
      {children}
    </OrgContext.Provider>
  );
}

/**
 * Hook to access organization context
 *
 * @throws Error if used outside OrgProvider
 */
export function useOrg() {
  const context = useContext(OrgContext);

  if (context === undefined) {
    throw new Error("useOrg must be used within an OrgProvider");
  }

  return context;
}

/**
 * Hook to get current organization ID
 */
export function useOrgId(): string | null {
  const { currentOrg } = useOrg();
  return currentOrg?.organizationId || null;
}

/**
 * Hook to check if the user's org has specific features enabled
 */
export function useOrgFeatures(requiredFeatures: string[]): boolean {
  const { currentOrg } = useOrg();

  if (!currentOrg?.features) {
    return false;
  }

  return requiredFeatures.every(feature =>
    currentOrg.features?.includes(feature)
  );
}

/**
 * Hook to get the current organization's subscription tier
 */
export function useOrgTier(): string | null {
  const { currentOrg } = useOrg();
  return currentOrg?.subscriptionTier || null;
}

