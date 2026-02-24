/**
 * Feature Flag Hooks & Components
 * 
 * Client-side utilities for progressive feature rollout.
 */

'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Feature flag context value
 */
interface FeatureFlagContextValue {
  flags: Record<string, boolean>;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Feature flag context
 */
const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

/**
 * Feature flag provider props
 */
interface FeatureFlagProviderProps {
  children: ReactNode;
  initialFlags?: Record<string, boolean>;
}

/**
 * Feature flag provider
 * 
 * Fetches and caches feature flags for the current user.
 * 
 * @example
 * ```tsx
 * <FeatureFlagProvider>
 *   <App />
 * </FeatureFlagProvider>
 * ```
 */
export function FeatureFlagProvider({ 
  children, 
  initialFlags = {} 
}: FeatureFlagProviderProps) {
  const [flags, setFlags] = useState<Record<string, boolean>>(initialFlags);
  const [isLoading, setIsLoading] = useState(true);
  
  const refresh = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/feature-flags');
      
      if (response.ok) {
        const data = await response.json();
        setFlags(data.flags || {});
      }
    } catch (_error) {
} finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    refresh();
  }, []);
  
  return (
    <FeatureFlagContext.Provider value={{ flags, isLoading, refresh }}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

/**
 * Use feature flag hook
 * 
 * Returns whether a feature is enabled for the current user.
 * 
 * @example
 * ```tsx
 * const hasSignalsUI = useFeatureFlag('lro_signals_ui');
 * 
 * if (hasSignalsUI) {
 *   return <SignalBadge signal={signal} />;
 * }
 * ```
 */
export function useFeatureFlag(featureName: string): boolean {
  const context = useContext(FeatureFlagContext);
  
  if (!context) {
return false;
  }
  
  return context.flags[featureName] ?? false;
}

/**
 * Use feature flags hook (plural)
 * 
 * Returns multiple feature flag states at once.
 * 
 * @example
 * ```tsx
 * const flags = useFeatureFlags(['lro_signals_ui', 'lro_auto_refresh']);
 * 
 * if (flags.lro_signals_ui) {
 *   // Render signals UI
 * }
 * ```
 */
export function useFeatureFlags(featureNames: string[]): Record<string, boolean> {
  const context = useContext(FeatureFlagContext);
  
  if (!context) {
return featureNames.reduce((acc, name) => {
      acc[name] = false;
      return acc;
    }, {} as Record<string, boolean>);
  }
  
  return featureNames.reduce((acc, name) => {
    acc[name] = context.flags[name] ?? false;
    return acc;
  }, {} as Record<string, boolean>);
}

/**
 * Use all feature flags hook
 * 
 * Returns all feature flags and loading state.
 * 
 * @example
 * ```tsx
 * const { flags, isLoading, refresh } = useAllFeatureFlags();
 * ```
 */
export function useAllFeatureFlags(): FeatureFlagContextValue {
  const context = useContext(FeatureFlagContext);
  
  if (!context) {
    throw new Error('useAllFeatureFlags must be used within FeatureFlagProvider');
  }
  
  return context;
}

/**
 * Feature gate component
 * 
 * Only renders children if feature is enabled.
 * 
 * @example
 * ```tsx
 * <FeatureGate feature="lro_signals_ui">
 *   <SignalBadge signal={signal} />
 * </FeatureGate>
 * ```
 */
interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const isEnabled = useFeatureFlag(feature);
  
  if (!isEnabled) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * Multiple feature gate component
 * 
 * Only renders children if ALL features are enabled.
 * 
 * @example
 * ```tsx
 * <MultiFeatureGate features={['lro_signals_ui', 'lro_dashboard_widget']}>
 *   <DashboardSignalsWidget cases={cases} />
 * </MultiFeatureGate>
 * ```
 */
interface MultiFeatureGateProps {
  features: string[];
  children: ReactNode;
  fallback?: ReactNode;
  requireAll?: boolean; // If false, renders if ANY feature is enabled
}

export function MultiFeatureGate({ 
  features, 
  children, 
  fallback = null,
  requireAll = true 
}: MultiFeatureGateProps) {
  const flags = useFeatureFlags(features);
  
  const shouldRender = requireAll
    ? features.every(feature => flags[feature])
    : features.some(feature => flags[feature]);
  
  if (!shouldRender) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

