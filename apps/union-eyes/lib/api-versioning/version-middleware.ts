/**
 * API Versioning Middleware
 * 
 * Supports multiple API versioning strategies:
 * 1. URL Path Versioning: /api/v1/claims vs /api/v2/claims
 * 2. Header Versioning: Accept: application/vnd.unioneyes.v1+json
 * 3. Query Parameter: /api/claims?version=1
 * 
 * Features:
 * - Automatic version detection
 * - Version deprecation warnings
 * - Backward compatibility support
 * - Sunset dates for old versions
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export type ApiVersion = 'v1' | 'v2';

export interface VersionConfig {
  version: ApiVersion;
  isDeprecated: boolean;
  sunsetDate?: Date;
  replacedBy?: ApiVersion;
}

export const API_VERSIONS: Record<ApiVersion, VersionConfig> = {
  v1: {
    version: 'v1',
    isDeprecated: false,
    sunsetDate: undefined,
    replacedBy: undefined,
  },
  v2: {
    version: 'v2',
    isDeprecated: false,
    sunsetDate: undefined,
    replacedBy: undefined,
  },
};

export const CURRENT_VERSION: ApiVersion = 'v1';
export const LATEST_VERSION: ApiVersion = 'v2';

/**
 * Extract API version from request
 */
export function getApiVersion(request: NextRequest): ApiVersion {
  // 1. Check URL path (/api/v1/...)
  const urlVersion = extractVersionFromUrl(request.nextUrl.pathname);
  if (urlVersion) return urlVersion;

  // 2. Check Accept header (Accept: application/vnd.unioneyes.v1+json)
  const headerVersion = extractVersionFromHeader(request.headers.get('accept'));
  if (headerVersion) return headerVersion;

  // 3. Check query parameter (?version=1)
  const queryVersion = request.nextUrl.searchParams.get('version');
  if (queryVersion) {
    const version = `v${queryVersion}` as ApiVersion;
    if (API_VERSIONS[version]) return version;
  }

  // 4. Check custom header (X-API-Version: v1)
  const customHeader = request.headers.get('x-api-version');
  if (customHeader && API_VERSIONS[customHeader as ApiVersion]) {
    return customHeader as ApiVersion;
  }

  // Default to current version
  return CURRENT_VERSION;
}

/**
 * Extract version from URL path
 */
function extractVersionFromUrl(pathname: string): ApiVersion | null {
  const match = pathname.match(/\/api\/(v\d+)\//);
  if (match && match[1]) {
    const version = match[1] as ApiVersion;
    return API_VERSIONS[version] ? version : null;
  }
  return null;
}

/**
 * Extract version from Accept header
 */
function extractVersionFromHeader(acceptHeader: string | null): ApiVersion | null {
  if (!acceptHeader) return null;
  
  const match = acceptHeader.match(/application\/vnd\.unioneyes\.(v\d+)\+json/);
  if (match && match[1]) {
    const version = match[1] as ApiVersion;
    return API_VERSIONS[version] ? version : null;
  }
  return null;
}

/**
 * Add version headers to response
 */
export function addVersionHeaders(
  response: NextResponse,
  version: ApiVersion
): NextResponse {
  const config = API_VERSIONS[version];

  // Add version identifier
  response.headers.set('X-API-Version', version);
  response.headers.set('X-API-Latest-Version', LATEST_VERSION);

  // Add deprecation warnings
  if (config.isDeprecated) {
    response.headers.set('Deprecation', 'true');
    
    if (config.sunsetDate) {
      response.headers.set('Sunset', config.sunsetDate.toUTCString());
    }
    
    if (config.replacedBy) {
      response.headers.set('X-API-Replaced-By', config.replacedBy);
    }

    // Warning header (RFC 7234)
    const warningMsg = config.sunsetDate
      ? `299 - "API version ${version} is deprecated and will be sunset on ${config.sunsetDate.toDateString()}"`
      : `299 - "API version ${version} is deprecated"`;
    
    response.headers.set('Warning', warningMsg);
  }

  return response;
}

/**
 * Version-aware API handler wrapper
 */
export function withVersioning<_T>(
  handlers: Partial<Record<ApiVersion, (request: NextRequest) => Promise<NextResponse>>>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const version = getApiVersion(request);
    const handler = handlers[version];

    if (!handler) {
      logger.warn('API version not supported', { version, path: request.nextUrl.pathname });
      
      return NextResponse.json(
        {
          error: 'API version not supported',
          version,
          supportedVersions: Object.keys(API_VERSIONS),
          latestVersion: LATEST_VERSION,
        },
        { status: 400 }
      );
    }

    const config = API_VERSIONS[version];

    // Log deprecation usage
    if (config.isDeprecated) {
      logger.warn('Deprecated API version used', {
        version,
        path: request.nextUrl.pathname,
        sunsetDate: config.sunsetDate,
        replacedBy: config.replacedBy,
      });
    }

    // Execute handler
    const response = await handler(request);

    // Add version headers
    return addVersionHeaders(response, version);
  };
}

/**
 * Deprecate an API version
 */
export function deprecateVersion(
  version: ApiVersion,
  sunsetDate: Date,
  replacedBy: ApiVersion
): void {
  API_VERSIONS[version] = {
    ...API_VERSIONS[version],
    isDeprecated: true,
    sunsetDate,
    replacedBy,
  };

  logger.info('API version deprecated', {
    version,
    sunsetDate,
    replacedBy,
  });
}

/**
 * Check if version is supported
 */
export function isVersionSupported(version: string): boolean {
  return version in API_VERSIONS;
}

/**
 * Get version configuration
 */
export function getVersionConfig(version: ApiVersion): VersionConfig {
  return API_VERSIONS[version];
}

