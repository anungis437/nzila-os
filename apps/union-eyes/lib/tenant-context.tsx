"use client";

/**
 * Tenant Context Provider
 * 
 * Provides tenant context throughout the application.
 * Supports tenant switching for multi-tenant scenarios.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
 
import { useAuth, useOrganization } from "@clerk/nextjs";

// Tenant information interface
export interface TenantInfo {
  organizationId: string;
  name: string;
  slug: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings?: Record<string, any>;
  subscriptionTier?: string;
  features?: string[];
}

// Tenant context type
interface TenantContextType {
  currentTenant: TenantInfo | null;
  tenants: TenantInfo[];
  isLoading: boolean;
  error: Error | null;
  switchTenant: (organizationId: string) => Promise<void>;
  refreshTenants: () => Promise<void>;
}

// Create context with undefined default
const TenantContext = createContext<TenantContextType | undefined>(undefined);

// Provider props
interface TenantProviderProps {
  children: React.ReactNode;
}

/**
 * Tenant Provider Component
 * 
 * Wraps the application to provide tenant context.
 * Automatically loads tenant information based on Clerk organization.
 */
export function TenantProvider({ children }: TenantProviderProps) {
  const { userId, isLoaded: authLoaded } = useAuth();
  const { organization: _organization, isLoaded: orgLoaded } = useOrganization();
  
  const [currentTenant, setCurrentTenant] = useState<TenantInfo | null>(null);
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch tenant information from API
   */
  const fetchTenantInfo = useCallback(async () => {
    if (!userId || !authLoaded) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch current tenant information
      const response = await fetch("/api/tenant/current", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tenant info: ${response.statusText}`);
      }

      const data = await response.json();
      
      setCurrentTenant(data.tenant);
      setTenants(data.availableTenants || [data.tenant]);
    } catch (err) {
setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [userId, authLoaded]);

  /**
   * Switch to a different tenant
   */
  const switchTenant = useCallback(async (organizationId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/tenant/switch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ organizationId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to switch tenant: ${response.statusText}`);
      }

      const data = await response.json();
      setCurrentTenant(data.tenant);

      // Reload the page to refresh all tenant-specific data
      window.location.reload();
    } catch (err) {
setError(err instanceof Error ? err : new Error("Unknown error"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh tenant list
   */
  const refreshTenants = useCallback(async () => {
    await fetchTenantInfo();
  }, [fetchTenantInfo]);

  // Load tenant info when auth is ready
  useEffect(() => {
    if (authLoaded && orgLoaded) {
      fetchTenantInfo();
    }
  }, [authLoaded, orgLoaded, fetchTenantInfo]);

  const value: TenantContextType = {
    currentTenant,
    tenants,
    isLoading,
    error,
    switchTenant,
    refreshTenants,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

/**
 * Hook to access tenant context
 * 
 * @throws Error if used outside TenantProvider
 */
export function useTenant() {
  const context = useContext(TenantContext);
  
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  
  return context;
}

/**
 * Hook to get current tenant ID
 * Convenience hook that returns just the tenant ID
 */
export function useTenantId(): string | null {
  const { currentTenant } = useTenant();
  return currentTenant?.organizationId || null;
}

/**
 * Hook to check if user has access to specific tenant features
 */
export function useTenantFeatures(requiredFeatures: string[]): boolean {
  const { currentTenant } = useTenant();
  
  if (!currentTenant?.features) {
    return false;
  }
  
  return requiredFeatures.every(feature => 
    currentTenant.features?.includes(feature)
  );
}

/**
 * Hook to check tenant subscription tier
 */
export function useTenantTier(): string | null {
  const { currentTenant } = useTenant();
  return currentTenant?.subscriptionTier || null;
}

