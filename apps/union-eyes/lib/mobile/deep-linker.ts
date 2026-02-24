/**
 * Deep Linker Library
 * 
 * Handles universal deep linking for mobile apps (iOS/Android)
 * and PWA fallback for web
 * 
 * Supported link formats:
 * - https://unioneyes.app/claim/123
 * - https://unioneyes.app/member/456
 * - https://unioneyes.app/employer/789
 * - https://unioneyes.app/message/thread/abc
 * - https://unioneyes.app/union/committee/def
 */

import { logger } from '@/lib/logger';

// Deep link configuration
export interface DeepLinkConfig {
  scheme: string;
  host: string;
  paths: DeepLinkPath[];
}

export interface DeepLinkPath {
  pattern: string;
  route: string;
  params: string[];
}

export interface ParsedDeepLink {
  route: string;
  params: Record<string, string>;
  query: Record<string, string>;
  fragment: string;
}

// Default deep link configuration
const DEFAULT_CONFIG: DeepLinkConfig = {
  scheme: 'https',
  host: 'unioneyes.app',
  paths: [
    { pattern: '/claim/:id', route: '/claim/[id]', params: ['id'] },
    { pattern: '/member/:id', route: '/member/[id]', params: ['id'] },
    { pattern: '/employer/:id', route: '/employer/[id]', params: ['id'] },
    { pattern: '/union/:type/:id', route: '/union/[type]/[id]', params: ['type', 'id'] },
    { pattern: '/message/thread/:id', route: '/message/thread/[id]', params: ['id'] },
    { pattern: '/document/:id', route: '/document/[id]', params: ['id'] },
    { pattern: '/notification/:id', route: '/notification/[id]', params: ['id'] },
    { pattern: '/calendar/event/:id', route: '/calendar/event/[id]', params: ['id'] },
    { pattern: '/vote/:id', route: '/vote/[id]', params: ['id'] },
    { pattern: '/grievance/:id', route: '/grievance/[id]', params: ['id'] },
  ],
};

/**
 * DeepLinker class for parsing and handling deep links
 */
export class DeepLinker {
  private config: DeepLinkConfig;

  constructor(config: Partial<DeepLinkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Parse a deep link URL into route and parameters
   */
  parse(url: string): ParsedDeepLink | null {
    try {
      const parsedUrl = new URL(url);
      
      // Check if this is a deep link for our app
      if (!this.isAppLink(parsedUrl)) {
        logger.warn('Not an app deep link', { url });
        return null;
      }

      const path = parsedUrl.pathname;
      const route = this.matchRoute(path);
      
      if (!route) {
        logger.warn('No matching route for path', { path });
        return null;
      }

      // Extract parameters from path
      const params = this.extractParams(route.pattern, path);

      // Extract query parameters
      const query: Record<string, string> = {};
      parsedUrl.searchParams.forEach((value, key) => {
        query[key] = value;
      });

      // Extract fragment
      const fragment = parsedUrl.hash.replace('#', '');

      return {
        route: route.route,
        params,
        query,
        fragment,
      };
    } catch (error) {
      logger.error('Failed to parse deep link', { url, error });
      return null;
    }
  }

  /**
   * Build a deep link URL from route and parameters
   */
  build(route: string, params: Record<string, string> = {}, query: Record<string, string> = {}): string {
    const url = new URL(`${this.config.scheme}://${this.config.host}`);

    // Convert route params to path
    let path = route;
    for (const [key, value] of Object.entries(params)) {
      path = path.replace(`[${key}]`, value);
      path = path.replace(`:${key}`, value);
    }

    url.pathname = path;

    // Add query parameters
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  /**
   * Build a mobile app deep link (custom scheme)
   */
  buildMobile(route: string, params: Record<string, string> = {}): string {
    const url = new URL(`${this.config.scheme}://${this.config.host}.mobile`);
    
    let path = route;
    for (const [key, value] of Object.entries(params)) {
      path = path.replace(`[${key}]`, value);
    }
    
    url.pathname = path;
    return url.toString();
  }

  /**
   * Check if URL is an app link
   */
  private isAppLink(url: URL): boolean {
    return (
      url.hostname === this.config.host ||
      url.hostname === `${this.config.host}.mobile` ||
      url.protocol === `${this.config.scheme}:`
    );
  }

  /**
   * Match a path to a route pattern
   */
  private matchRoute(path: string): DeepLinkPath | null {
    // Normalize path
    const normalizedPath = path.replace(/\/+$/, '') || '/';

    for (const route of this.config.paths) {
      if (this.matchPattern(route.pattern, normalizedPath)) {
        return route;
      }
    }

    // Default routes
    if (normalizedPath === '/' || normalizedPath === '/home') {
      return { pattern: '/', route: '/dashboard', params: [] };
    }

    return null;
  }

  /**
   * Match a route pattern to a path
   */
  private matchPattern(pattern: string, path: string): boolean {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    if (patternParts.length !== pathParts.length) {
      return false;
    }

    return patternParts.every((part, index) => {
      if (part.startsWith(':')) {
        return true; // Parameter placeholder
      }
      return part === pathParts[index];
    });
  }

  /**
   * Extract parameters from path using route pattern
   */
  private extractParams(pattern: string, path: string): Record<string, string> {
    const params: Record<string, string> = {};
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    patternParts.forEach((part, index) => {
      if (part.startsWith(':')) {
        const paramName = part.slice(1);
        params[paramName] = pathParts[index] || '';
      }
    });

    return params;
  }
}

/**
 * Handle incoming deep link on client side
 */
export async function handleDeepLink(url: string): Promise<boolean> {
  const linker = new DeepLinker();
  const parsed = linker.parse(url);

  if (!parsed) {
    return false;
  }

  // Navigate to the parsed route
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof window !== 'undefined' && (window as any).navigate) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).navigate(parsed.route, parsed.params, parsed.query);
    return true;
  }

  // For SSR or when navigation is not available
  return true;
}

/**
 * Register deep link handlers for mobile
 */
export function registerDeepLinkHandlers(): void {
  if (typeof window === 'undefined') return;

  // Handle universal links (iOS)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((navigator as any).registerProtocolHandler) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).registerProtocolHandler(
        'unioneyes',
        `${window.location.origin}/deep-link?url=%s`,
        'Union Eyes'
      );
    } catch (error) {
      logger.warn('Failed to register protocol handler', error);
    }
  }

  // Handle App Links (Android)
  // These are handled by the OS automatically when app is installed

  // Listen for popstate to handle back navigation
  window.addEventListener('popstate', (event) => {
    if (event.state?.deepLink) {
      handleDeepLink(event.state.deepLink);
    }
  });
}

// Export singleton instance
export const deepLinker = new DeepLinker();
